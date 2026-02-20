import path from "node:path";

import { configLoad } from "../config/configLoad.js";
import { DEFAULT_SETTINGS_PATH } from "../settings.js";
import { storageUpgrade } from "../storage/storageUpgrade.js";

export type UpgradeOptions = {
    settings?: string;
};

export async function upgradeCommand(options: UpgradeOptions): Promise<void> {
    intro("daycare upgrade");
    const settingsPath = path.resolve(options.settings ?? DEFAULT_SETTINGS_PATH);
    const config = await configLoad(settingsPath);
    const result = await storageUpgrade(config);

    if (result.applied.length === 0) {
        outro("Storage already up to date.");
        return;
    }

    outro(`Applied migrations: ${result.applied.join(", ")}`);
}

function intro(message: string): void {
    console.log(message);
}

function outro(message: string): void {
    console.log(message);
}
