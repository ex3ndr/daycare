import { promises as fs } from "node:fs";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import type { Config } from "@/types";
import { getLogger } from "../../log.js";
import type { Storage } from "../../storage/storage.js";
import { storageResolve } from "../../storage/storageResolve.js";
import { agentPromptPathsResolve } from "../agents/ops/agentPromptPathsResolve.js";
import { UserHome } from "./userHome.js";
import { userHomeEnsure } from "./userHomeEnsure.js";

const MARKER_FILENAME = ".migrated";
const logger = getLogger("engine.users.migrate");

/**
 * Migrates legacy shared files/apps into the owner user's UserHome tree once.
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
    await userHomeEnsure(ownerHome);
    await knowledgeFilesCopy(config, ownerHome);
    await directoryCopy(config.filesDir, ownerHome.desktop);
    await directoryCopy(path.join(config.workspaceDir, "apps"), ownerHome.apps);
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

async function knowledgeFilesCopy(config: Config, ownerHome: UserHome): Promise<void> {
    const legacyPaths = agentPromptPathsResolve(config.dataDir);
    const nextPaths = ownerHome.knowledgePaths();
    const pairs = [
        { from: legacyPaths.soulPath, to: nextPaths.soulPath },
        { from: legacyPaths.userPath, to: nextPaths.userPath },
        { from: legacyPaths.agentsPath, to: nextPaths.agentsPath },
        { from: legacyPaths.toolsPath, to: nextPaths.toolsPath },
        { from: legacyPaths.memoryPath, to: nextPaths.memoryPath }
    ];
    for (const pair of pairs) {
        if (!(await pathExists(pair.from))) {
            continue;
        }
        await fs.mkdir(path.dirname(pair.to), { recursive: true });
        await fs.copyFile(pair.from, pair.to);
    }
}

async function directoryCopy(sourceDir: string, targetDir: string): Promise<void> {
    if (!(await pathExists(sourceDir))) {
        return;
    }
    await fs.mkdir(targetDir, { recursive: true });
    await fs.cp(sourceDir, targetDir, { recursive: true, force: false, dereference: false });
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
