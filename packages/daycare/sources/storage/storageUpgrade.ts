import type { Config } from "@/types";
import { getLogger } from "../log.js";
import { databaseOpen } from "./databaseOpen.js";
import { migrations } from "./migrations/_migrations.js";
import { migrationPending } from "./migrations/migrationPending.js";
import { migrationRun } from "./migrations/migrationRun.js";

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
        const pendingBefore = migrationPending(db, migrations).map((entry) => entry.name);
        const applied = migrationRun(db);
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
        db.close();
    }
}
