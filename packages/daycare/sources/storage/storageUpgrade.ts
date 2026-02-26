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
 * Expects: config.dbPath points to the runtime SQLite database path.
 */
export async function storageUpgrade(config: Config): Promise<StorageUpgradeResult> {
    const db = databaseOpen(config.dbPath);
    try {
        const appliedBefore = await migrationAppliedNamesRead(db);
        const pendingBefore = migrations.map((migration) => migration.name).filter((name) => !appliedBefore.has(name));

        databaseMigrate(db);

        const appliedAfter = await migrationAppliedNamesRead(db);
        const applied = pendingBefore.filter((name) => appliedAfter.has(name));
        logger.info(
            {
                dbPath: config.dbPath,
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
