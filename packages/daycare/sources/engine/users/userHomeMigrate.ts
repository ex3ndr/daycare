import { promises as fs } from "node:fs";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import type { Config } from "@/types";
import { getLogger } from "../../log.js";
import type { Storage } from "../../storage/storage.js";
import { storageResolve } from "../../storage/storageResolve.js";
import { contextForUser } from "../agents/context.js";
import { documentSystemDocsEnsure } from "../document/documentSystemDocsEnsure.js";
import { UserHome } from "./userHome.js";
import { userHomeEnsure } from "./userHomeEnsure.js";

const MARKER_FILENAME = ".migrated";
const logger = getLogger("engine.users.migrate");

/**
 * Migrates legacy system prompt files into the owner user's document store once.
 * Expects: storage migrations have already run and config paths are absolute.
 */
export async function userHomeMigrate(config: Config, storageOrConfig?: Storage | Config): Promise<void> {
    const storage = storageResolve(storageOrConfig ?? config);
    const markerPath = path.join(config.usersDir, MARKER_FILENAME);
    if (await pathExists(markerPath)) {
        return;
    }

    const ownerUserId = await ownerUserIdEnsure(storage);
    const ownerHome = new UserHome(config.usersDir, ownerUserId);
    const ownerCtx = contextForUser({ userId: ownerUserId });
    await userHomeEnsure(ownerHome);
    await documentSystemDocsEnsure(ownerCtx, storage);
    await knowledgeFilesMigrate(config, ownerHome, ownerCtx, storage);
    await fs.mkdir(config.usersDir, { recursive: true });
    await fs.writeFile(markerPath, `${JSON.stringify({ migratedAt: Date.now(), ownerUserId }, null, 2)}\n`, "utf8");
}

async function ownerUserIdEnsure(storage: Storage): Promise<string> {
    const users = await storage.users.findMany();
    const owner = users.find((entry) => entry.isOwner);
    if (owner) {
        return owner.id;
    }
    const fallbackOwner = users[0];
    if (fallbackOwner) {
        logger.warn(
            { userId: fallbackOwner.id },
            "warn: User table had no owner; promoting earliest user to owner for migration"
        );
        await storage.users.update(fallbackOwner.id, { isOwner: true, updatedAt: Date.now() });
        return fallbackOwner.id;
    }
    const now = Date.now();
    const ownerId = createId();
    await storage.users.create({
        id: ownerId,
        isOwner: true,
        createdAt: now,
        updatedAt: now
    });
    return ownerId;
}

async function knowledgeFilesMigrate(
    config: Config,
    ownerHome: UserHome,
    ctx: ReturnType<typeof contextForUser>,
    storage: Storage
): Promise<void> {
    const system = await storage.documents.findBySlugAndParent(ctx, "system", null);
    if (!system) {
        throw new Error("Missing ~/system root during userHome migration.");
    }

    const legacyKnowledgeDir = path.join(ownerHome.home, "knowledge");
    const files = [
        { slug: "soul", filename: "SOUL.md" },
        { slug: "user", filename: "USER.md" },
        { slug: "agents", filename: "AGENTS.md" },
        { slug: "tools", filename: "TOOLS.md" }
    ];

    for (const file of files) {
        const content = await legacyPromptContentLoad([
            path.join(legacyKnowledgeDir, file.filename),
            path.join(config.dataDir, file.filename)
        ]);
        if (content === null) {
            continue;
        }

        const document = await storage.documents.findBySlugAndParent(ctx, file.slug, system.id);
        if (!document) {
            throw new Error(`Missing ~/system/${file.slug} during userHome migration.`);
        }

        await storage.documents.update(ctx, document.id, {
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
