import { rm } from "node:fs/promises";
import path from "node:path";

/**
 * Removes persisted restart confirmation metadata.
 * Expects: dataDir points to the plugin data directory.
 */
export async function upgradeRestartPendingClear(dataDir: string): Promise<void> {
    await rm(path.join(dataDir, "restart-pending.json"), { force: true });
}
