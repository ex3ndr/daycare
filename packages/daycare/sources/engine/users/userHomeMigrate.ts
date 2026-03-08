import { promises as fs } from "node:fs";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import type { Config } from "@/types";
import { getLogger } from "../../log.js";
import type { Storage } from "../../storage/storage.js";
import { storageResolve } from "../../storage/storageResolve.js";
import { contextForUser } from "../agents/context.js";
import { userDocumentsEnsure } from "./userDocumentsEnsure.js";
import { UserHome } from "./userHome.js";
import { userHomeEnsure } from "./userHomeEnsure.js";

const MARKER_FILENAME = ".migrated";
const logger = getLogger("engine.users.migrate");
const SYSTEM_PROMPT_FILES = [
    { slug: "soul", filename: "SOUL.md" },
    { slug: "user", filename: "USER.md" },
    { slug: "agents", filename: "AGENTS.md" },
    { slug: "tools", filename: "TOOLS.md" }
] as const;

/**
 * Migrates legacy system prompt files into each user's document store once.
 * Expects: storage migrations have already run and config paths are absolute.
 */
export async function userHomeMigrate(config: Config, storageOrConfig?: Storage | Config): Promise<void> {
    const storage = storageResolve(storageOrConfig ?? config);
    const markerPath = path.join(config.usersDir, MARKER_FILENAME);
    if (await pathExists(markerPath)) {
        return;
    }

    const ownerUserId = await primaryUserIdEnsure(storage);
    const users = await storage.users.findMany();
    for (const user of users) {
        const userHome = new UserHome(config.usersDir, user.id);
        const ctx = contextForUser({ userId: user.id });
        await userHomeEnsure(userHome);
        await userDocumentsEnsure(ctx, storage);
        await knowledgeFilesMigrate({
            config,
            userHome,
            ctx,
            storage,
            includeGlobalFallback: user.id === ownerUserId
        });
    }
    await fs.mkdir(config.usersDir, { recursive: true });
    await fs.writeFile(
        markerPath,
        `${JSON.stringify({ migratedAt: Date.now(), ownerUserId, migratedUserIds: users.map((user) => user.id) }, null, 2)}\n`,
        "utf8"
    );
}

async function primaryUserIdEnsure(storage: Storage): Promise<string> {
    const users = await storage.users.findMany();
    const primary = users.find((entry) => !entry.isWorkspace && entry.parentUserId === null);
    if (primary) {
        return primary.id;
    }
    if (users.length > 0) {
        logger.warn("warn: User table had no personal root user; creating one for migration fallback");
    }
    const now = Date.now();
    const ownerId = createId();
    await storage.users.create({
        id: ownerId,
        createdAt: now,
        updatedAt: now
    });
    return ownerId;
}

async function knowledgeFilesMigrate(input: {
    config: Config;
    userHome: UserHome;
    ctx: ReturnType<typeof contextForUser>;
    storage: Storage;
    includeGlobalFallback: boolean;
}): Promise<void> {
    const system = await input.storage.documents.findBySlugAndParent(input.ctx, "system", null);
    if (!system) {
        throw new Error("Missing doc://system root during userHome migration.");
    }

    const legacyKnowledgeDir = path.join(input.userHome.home, "knowledge");

    for (const file of SYSTEM_PROMPT_FILES) {
        const candidatePaths = [path.join(legacyKnowledgeDir, file.filename)];
        if (input.includeGlobalFallback) {
            candidatePaths.push(path.join(input.config.dataDir, file.filename));
        }
        const content = await legacyPromptContentLoad([...candidatePaths]);
        if (content === null) {
            continue;
        }

        const document = await input.storage.documents.findBySlugAndParent(input.ctx, file.slug, system.id);
        if (!document) {
            throw new Error(`Missing doc://system/${file.slug} during userHome migration.`);
        }

        await input.storage.documents.update(input.ctx, document.id, {
            body: content,
            updatedAt: Date.now()
        });
    }
}

async function pathExists(targetPath: string): Promise<boolean> {
    try {
        await fs.access(targetPath);
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return false;
        }
        throw error;
    }
}

async function legacyPromptContentLoad(paths: string[]): Promise<string | null> {
    for (const targetPath of paths) {
        if (!(await pathExists(targetPath))) {
            continue;
        }
        return fs.readFile(targetPath, "utf8");
    }
    return null;
}
