import path from "node:path";
import { configLoad } from "../config/configLoad.js";
import { workspaceSystemEnsure } from "../engine/workspaces/workspaceSystemEnsure.js";
import { DEFAULT_SETTINGS_PATH } from "../settings.js";
import { databaseClose } from "../storage/databaseClose.js";
import { storageOpen } from "../storage/storageOpen.js";
import { type AppLinkOptions, appLinkCommand } from "./appLink.js";

/**
 * Generates a terminal-friendly Daycare app auth URL for the reserved system workspace.
 * Expects: settings points to a valid settings file and bootstrap reserves the `system` user id.
 */
export async function appLinkSystemCommand(options: AppLinkOptions): Promise<void> {
    const settingsPath = path.resolve(options.settings ?? DEFAULT_SETTINGS_PATH);
    let storage: Awaited<ReturnType<typeof storageOpen>> | null = null;

    try {
        const config = await configLoad(settingsPath);
        storage = await storageOpen(config.db.path, {
            url: config.db.url,
            autoMigrate: config.db.autoMigrate
        });
        await workspaceSystemEnsure({ storage });
        await appLinkCommand("system", { ...options, settings: settingsPath });
    } catch (error) {
        process.exitCode = 1;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to generate system workspace app link: ${message}`);
    } finally {
        if (storage) {
            await databaseClose(storage.connection);
        }
    }
}
