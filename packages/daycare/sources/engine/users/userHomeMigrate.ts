import { promises as fs } from "node:fs";
import path from "node:path";
import type { Config } from "@/types";
import type { Storage } from "../../storage/storage.js";
import { storageResolve } from "../../storage/storageResolve.js";
import { contextForUser } from "../agents/context.js";
import { userDocumentsEnsure } from "./userDocumentsEnsure.js";
import { UserHome } from "./userHome.js";
import { userHomeEnsure } from "./userHomeEnsure.js";

const MARKER_FILENAME = ".migrated";
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

    const users = await storage.users.findMany();
    const fallbackUserId = users.find((user) => !user.isWorkspace && user.parentUserId === null)?.id ?? null;
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
            includeGlobalFallback: user.id === fallbackUserId
        });
    }
    await fs.mkdir(config.usersDir, { recursive: true });
    await fs.writeFile(
        markerPath,
        `${JSON.stringify({ migratedAt: Date.now(), fallbackUserId, migratedUserIds: users.map((user) => user.id) }, null, 2)}\n`,
        "utf8"
    );
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
