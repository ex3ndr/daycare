import type { Config } from "@/types";
import { getLogger } from "../log.js";
import { databaseClose } from "./databaseClose.js";
import { databaseMigrate } from "./databaseMigrate.js";
import { databaseOpen } from "./databaseOpen.js";
import type { StorageDatabase } from "./databaseOpen.js";
import { migrations } from "./migrations/_migrations.js";

const logger = getLogger("storage.upgrade");

export type StorageUpgradeResult = {
    pendingBefore: string[];
    applied: string[];
};

/**
 * Opens the configured database and applies pending storage migrations.
 * Expects: config database settings point to a reachable pglite or postgres target.
 */
export async function storageUpgrade(config: Config): Promise<StorageUpgradeResult> {
    const dbTarget = config.url ? { kind: "postgres" as const, url: config.url } : config.path;
    const db = databaseOpen(dbTarget);
    try {
        const appliedBefore = await migrationAppliedNamesRead(db);
        const pendingBefore = migrations.map((migration) => migration.name).filter((name) => !appliedBefore.has(name));

        await databaseMigrate(db);

        const appliedAfter = await migrationAppliedNamesRead(db);
        const applied = pendingBefore.filter((name) => appliedAfter.has(name));
        logger.info(
            {
                path: config.path,
                dbTarget: config.url ? "postgres" : "pglite",
                pendingBefore,
                applied
            },
            "event: Storage upgrade complete"
        );
        return { pendingBefore, applied };
    } finally {
        await databaseClose(db);
    }
}

async function migrationAppliedNamesRead(db: StorageDatabase): Promise<Set<string>> {
    try {
        const rows = await db.prepare("SELECT name FROM _migrations").all<{ name: string }>();
        return new Set(rows.map((row) => row.name));
    } catch {
        return new Set();
    }
}
