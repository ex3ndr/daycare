import { APP_AUTH_DEFAULT_ENDPOINT, APP_AUTH_EXPIRES_IN_SECONDS } from "../api/app-server/appAuthLinkTool.js";
import { appEndpointNormalize } from "../api/app-server/appEndpointNormalize.js";
import { APP_SERVER_DEFAULT_HOST, APP_SERVER_DEFAULT_PORT } from "../api/app-server/appServerSettingsResolve.js";
import type { AppServerSettings } from "../settings.js";

export type AppLinkCommandOptions = {
    host?: string;
    port?: string;
    appEndpoint?: string;
    serverEndpoint?: string;
    expiresInSeconds?: string;
};

export type AppLinkResolvedOptions = {
    host: string;
    port: number;
    appEndpoint: string;
    serverEndpoint?: string;
    expiresInSeconds: number;
    settingsJwtSecret?: string;
};

/**
 * Resolves app-link command options from CLI flags and appServer settings.
 * Expects: appServer values come from validated settings.
 */
export function appLinkOptionsResolve(
    options: AppLinkCommandOptions,
    appServer: AppServerSettings | undefined
): AppLinkResolvedOptions {
    const host = appLinkHostResolve(options.host, appServer?.host);
    const port = appLinkPortResolve(options.port, appServer?.port);
    const appEndpoint =
        appLinkEndpointResolve(options.appEndpoint, appServer?.appEndpoint, "appEndpoint") ?? APP_AUTH_DEFAULT_ENDPOINT;
    const serverEndpoint = appLinkEndpointResolve(options.serverEndpoint, appServer?.serverEndpoint, "serverEndpoint");
    const expiresInSeconds = appLinkExpiresResolve(options.expiresInSeconds);
    const settingsJwtSecret = appLinkSecretResolve(appServer?.jwtSecret);

    return {
        host,
        port,
        appEndpoint,
        serverEndpoint,
        expiresInSeconds,
        settingsJwtSecret
    };
}

function appLinkHostResolve(hostOption: string | undefined, hostSetting: unknown): string {
    const fromOption = hostOption?.trim();
    if (fromOption) {
        return fromOption;
    }

    if (typeof hostSetting === "string" && hostSetting.trim()) {
        return hostSetting.trim();
    }

    return APP_SERVER_DEFAULT_HOST;
}

function appLinkPortResolve(portOption: string | undefined, portSetting: unknown): number {
    const fromOption = appLinkPortParse(portOption);
    if (fromOption !== null) {
        return fromOption;
    }

    if (typeof portSetting === "number" && Number.isInteger(portSetting) && portSetting >= 1 && portSetting <= 65535) {
        return portSetting;
    }

    if (typeof portSetting === "string") {
        const parsed = appLinkPortParse(portSetting);
        if (parsed !== null) {
            return parsed;
        }
    }

    return APP_SERVER_DEFAULT_PORT;
}

function appLinkEndpointResolve(
    optionValue: string | undefined,
    settingValue: unknown,
    fieldName: string
): string | undefined {
    const fromOption = optionValue?.trim();
    if (fromOption) {
        return appEndpointNormalize(fromOption, fieldName);
    }

    if (typeof settingValue !== "string") {
        return undefined;
    }

    const normalized = settingValue.trim();
    if (!normalized) {
        return undefined;
    }
    return appEndpointNormalize(normalized, fieldName);
}

function appLinkPortParse(value: string | undefined): number | null {
    if (typeof value !== "string" || !value.trim()) {
        return null;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
        throw new Error("Port must be an integer between 1 and 65535.");
    }
    return parsed;
}

function appLinkExpiresResolve(value: string | undefined): number {
    if (!value || !value.trim()) {
        return APP_AUTH_EXPIRES_IN_SECONDS;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("expiresInSeconds must be a positive integer.");
    }
    return parsed;
}

function appLinkSecretResolve(secretSetting: unknown): string | undefined {
    if (typeof secretSetting !== "string") {
        return undefined;
    }

    const normalized = secretSetting.trim();
    return normalized ? normalized : undefined;
}
