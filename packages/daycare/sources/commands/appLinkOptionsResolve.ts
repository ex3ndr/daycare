import { APP_AUTH_EXPIRES_IN_SECONDS } from "../plugins/daycare-app-server/appAuthLinkTool.js";
import { appEndpointNormalize } from "../plugins/daycare-app-server/appEndpointNormalize.js";
import type { PluginInstanceSettings } from "../settings.js";

const APP_DEFAULT_HOST = "127.0.0.1";
const APP_DEFAULT_PORT = 7332;

export type AppLinkCommandOptions = {
    host?: string;
    port?: string;
    appDomain?: string;
    serverDomain?: string;
    instance?: string;
    expiresInSeconds?: string;
};

export type AppLinkResolvedOptions = {
    host: string;
    port: number;
    appDomain?: string;
    serverDomain?: string;
    expiresInSeconds: number;
    settingsJwtSecret?: string;
};

/**
 * Resolves app-link command options from CLI flags and daycare-app-server plugin settings.
 * Expects: plugin list comes from validated settings.
 */
export function appLinkOptionsResolve(
    options: AppLinkCommandOptions,
    plugins: PluginInstanceSettings[] = []
): AppLinkResolvedOptions {
    const plugin = appLinkPluginResolve(plugins, options.instance);
    const pluginSettings = appLinkSettingsResolve(plugin);

    const host = appLinkHostResolve(options.host, pluginSettings.host);
    const port = appLinkPortResolve(options.port, pluginSettings.port);
    const appDomain = appLinkEndpointResolve(options.appDomain, pluginSettings.appDomain, "appDomain");
    const serverDomain = appLinkEndpointResolve(options.serverDomain, pluginSettings.serverDomain, "serverDomain");
    const expiresInSeconds = appLinkExpiresResolve(options.expiresInSeconds);
    const settingsJwtSecret = appLinkSecretResolve(pluginSettings.jwtSecret);

    return {
        host,
        port,
        appDomain,
        serverDomain,
        expiresInSeconds,
        settingsJwtSecret
    };
}

function appLinkPluginResolve(
    plugins: PluginInstanceSettings[],
    instanceId: string | undefined
): PluginInstanceSettings | undefined {
    if (!instanceId) {
        return plugins.find((entry) => entry.pluginId === "daycare-app-server");
    }

    const target = plugins.find((entry) => entry.instanceId === instanceId);
    if (!target) {
        throw new Error(`Plugin instance "${instanceId}" was not found in settings.`);
    }
    if (target.pluginId !== "daycare-app-server") {
        throw new Error(`Plugin instance "${instanceId}" is not a daycare-app-server plugin.`);
    }
    return target;
}

function appLinkSettingsResolve(plugin: PluginInstanceSettings | undefined): Record<string, unknown> {
    if (!plugin || !plugin.settings || typeof plugin.settings !== "object") {
        return {};
    }
    return plugin.settings;
}

function appLinkHostResolve(hostOption: string | undefined, hostSetting: unknown): string {
    const fromOption = hostOption?.trim();
    if (fromOption) {
        return fromOption;
    }

    if (typeof hostSetting === "string" && hostSetting.trim()) {
        return hostSetting.trim();
    }

    return APP_DEFAULT_HOST;
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

    return APP_DEFAULT_PORT;
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
