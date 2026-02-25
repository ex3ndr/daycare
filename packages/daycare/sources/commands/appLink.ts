import path from "node:path";
import { AuthStore } from "../auth/store.js";
import { configLoad } from "../config/configLoad.js";
import { appAuthLinkGenerate } from "../plugins/daycare-app-server/appAuthLinkTool.js";
import { appJwtSecretResolve } from "../plugins/daycare-app-server/appJwtSecretResolve.js";
import { DEFAULT_SETTINGS_PATH } from "../settings.js";
import { type AppLinkCommandOptions, appLinkOptionsResolve } from "./appLinkOptionsResolve.js";

export type AppLinkOptions = AppLinkCommandOptions & {
    settings?: string;
    json?: boolean;
};

/**
 * Generates a terminal-friendly Daycare app auth URL for a user id.
 * Expects: userId is non-empty; settings points to a valid settings file when provided.
 */
export async function appLinkCommand(userId: string, options: AppLinkOptions): Promise<void> {
    const trimmedUserId = userId.trim();
    if (!trimmedUserId) {
        process.exitCode = 1;
        console.error("Failed to generate app link: userId is required.");
        return;
    }

    const settingsPath = path.resolve(options.settings ?? DEFAULT_SETTINGS_PATH);

    try {
        if (!options.json) {
            intro("daycare app-link");
        }

        const config = await configLoad(settingsPath);
        const resolved = appLinkOptionsResolve(options, config.settings.plugins ?? []);
        const authStore = new AuthStore(config);
        const secret = await appJwtSecretResolve(resolved.settingsJwtSecret, authStore);
        const link = await appAuthLinkGenerate({
            host: resolved.host,
            port: resolved.port,
            userId: trimmedUserId,
            secret,
            expiresInSeconds: resolved.expiresInSeconds
        });

        if (options.json) {
            console.log(
                JSON.stringify(
                    {
                        url: link.url,
                        token: link.token,
                        userId: link.userId,
                        expiresAt: link.expiresAt
                    },
                    null,
                    2
                )
            );
            return;
        }

        console.log(link.url);
        outro(`Generated app link for ${trimmedUserId}.`);
    } catch (error) {
        process.exitCode = 1;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to generate app link: ${message}`);
    }
}

function intro(message: string): void {
    console.log(message);
}

function outro(message: string): void {
    console.log(message);
}
