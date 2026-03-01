import { promises as fs } from "node:fs";
import path from "node:path";

import type { CronTaskDefinition as CronTaskConfig } from "./engine/cron/cronTypes.js";
import { resolveDaycarePath } from "./paths.js";

export type PluginInstanceSettings = {
    instanceId: string;
    pluginId: string;
    enabled?: boolean;
    settings?: Record<string, unknown>;
};

export type InferenceProviderSettings = {
    id: string;
    model?: string;
    options?: Record<string, unknown>;
};

export type ProviderImageSettings = {
    enabled?: boolean;
    model?: string;
    size?: string;
    quality?: "standard" | "hd";
    endpoint?: string;
    apiKeyHeader?: string;
    apiKeyPrefix?: string;
};

export type ProviderSettings = {
    id: string;
    enabled?: boolean;
    model?: string;
    options?: Record<string, unknown>;
    image?: ProviderImageSettings;
};

export type ModelRoleKey = "user" | "memory" | "memorySearch" | "subagent" | "task";
export type ModelFlavorKey = string;

export type BuiltinModelFlavor = "small" | "normal" | "large";

export const BUILTIN_MODEL_FLAVORS: Record<BuiltinModelFlavor, { description: string }> = {
    small: { description: "Fastest and lowest-cost path for lightweight tasks." },
    normal: { description: "Balanced default for most work." },
    large: { description: "Highest-capability path for difficult reasoning and coding." }
};

/**
 * Per-role model overrides. Each value uses "<providerId>/<modelName>" format.
 * When a role has no entry, the provider's default model is used.
 */
export type ModelRoleConfig = Partial<Record<ModelRoleKey, string>>;

/**
 * Optional per-flavor model overrides. Values use "<providerId>/<modelName>" format
 * plus a human-readable description shown to agents in system prompts.
 */
export type ModelFlavorEntry = {
    model: string;
    description: string;
};

export type ModelFlavorConfig = Record<ModelFlavorKey, ModelFlavorEntry>;

export type AgentSettings = {
    emergencyContextLimit?: number;
};

export type SecuritySettings = {
    appReviewerEnabled?: boolean;
};

export type AppServerSettings = {
    enabled?: boolean;
    host?: string;
    port?: number;
    appEndpoint?: string;
    serverEndpoint?: string;
    jwtSecret?: string;
    telegramInstanceId?: string;
};

export type DockerSettings = {
    enabled?: boolean;
    image?: string;
    tag?: string;
    socketPath?: string;
    runtime?: string;
    enableWeakerNestedSandbox?: boolean;
    readOnly?: boolean;
    unconfinedSecurity?: boolean;
    capAdd?: string[];
    capDrop?: string[];
    allowLocalNetworkingForUsers?: string[];
    isolatedDnsServers?: string[];
    localDnsServers?: string[];
};

export type ResolvedDockerSettings = {
    enabled: boolean;
    image: string;
    tag: string;
    socketPath?: string;
    runtime?: string;
    enableWeakerNestedSandbox: boolean;
    readOnly: boolean;
    unconfinedSecurity: boolean;
    capAdd: string[];
    capDrop: string[];
    allowLocalNetworkingForUsers: string[];
    isolatedDnsServers: string[];
    localDnsServers: string[];
};

export type ResolvedSettingsConfig = Omit<SettingsConfig, "agents" | "security" | "docker"> & {
    agents: Required<AgentSettings>;
    security: Required<SecuritySettings>;
    docker: ResolvedDockerSettings;
};

export type SettingsConfig = {
    docker?: DockerSettings;
    engine?: {
        socketPath?: string;
        dataDir?: string;
        db?: {
            path?: string;
            url?: string;
            autoMigrate?: boolean;
        };
    };
    assistant?: AssistantSettings;
    agents?: AgentSettings;
    security?: SecuritySettings;
    appServer?: AppServerSettings;
    plugins?: PluginInstanceSettings[];
    providers?: ProviderSettings[];
    inference?: {
        providers?: InferenceProviderSettings[];
    };
    cron?: {
        tasks?: CronTaskConfig[];
    };
    models?: ModelRoleConfig;
    modelFlavors?: ModelFlavorConfig;
    memory?: {
        enabled?: boolean;
        maxEntries?: number;
    };
};

export type AssistantSettings = {
    systemPrompt?: string;
};

export const DEFAULT_SETTINGS_PATH = resolveDaycarePath("settings.json");

export async function readSettingsFile(filePath: string = DEFAULT_SETTINGS_PATH): Promise<SettingsConfig> {
    const resolvedPath = path.resolve(filePath);

    try {
        const raw = await fs.readFile(resolvedPath, "utf8");
        return JSON.parse(raw) as SettingsConfig;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return {};
        }
        throw error;
    }
}

export async function writeSettingsFile(filePath: string, settings: SettingsConfig): Promise<void> {
    const resolvedPath = path.resolve(filePath);
    const dir = path.dirname(resolvedPath);

    if (dir && dir !== ".") {
        await fs.mkdir(dir, { recursive: true });
    }

    await fs.writeFile(resolvedPath, `${JSON.stringify(settings, null, 2)}\n`, {
        mode: 0o600
    });
}

export async function updateSettingsFile(
    filePath: string,
    updater: (settings: SettingsConfig) => SettingsConfig
): Promise<SettingsConfig> {
    const settings = await readSettingsFile(filePath);
    const updated = updater(settings);
    await writeSettingsFile(filePath, updated);
    return updated;
}

export function listPlugins(settings: SettingsConfig): PluginInstanceSettings[] {
    return normalizePlugins(settings.plugins ?? []);
}

export function listEnabledPlugins(settings: SettingsConfig): PluginInstanceSettings[] {
    return listPlugins(settings).filter((plugin) => plugin.enabled !== false);
}

export function upsertPlugin(
    plugins: PluginInstanceSettings[] | undefined,
    entry: PluginInstanceSettings
): PluginInstanceSettings[] {
    const list = normalizePlugins(plugins ?? []);
    const filtered = list.filter((item) => item.instanceId !== entry.instanceId);
    return [...filtered, entry];
}

export type NextPluginInstanceIdOptions = {
    exclusive?: boolean;
};

export function nextPluginInstanceId(
    pluginId: string,
    plugins: PluginInstanceSettings[] | undefined,
    options?: NextPluginInstanceIdOptions
): string {
    // Exclusive plugins can only be installed once - always use bare pluginId
    if (options?.exclusive) {
        return pluginId;
    }

    const list = normalizePlugins(plugins ?? []);
    const used = new Set(list.map((plugin) => plugin.instanceId));

    // First instance uses bare pluginId without suffix
    if (!used.has(pluginId)) {
        return pluginId;
    }

    // Subsequent instances use -2, -3, etc.
    let index = 2;
    while (used.has(`${pluginId}-${index}`)) {
        index += 1;
    }
    return `${pluginId}-${index}`;
}

export function removePlugin(
    plugins: PluginInstanceSettings[] | undefined,
    instanceId: string
): PluginInstanceSettings[] {
    return normalizePlugins(plugins ?? []).filter((item) => item.instanceId !== instanceId);
}

export function listProviders(settings: SettingsConfig): ProviderSettings[] {
    if (settings.providers && settings.providers.length > 0) {
        return settings.providers.map((provider) => ({ ...provider }));
    }
    return (settings.inference?.providers ?? []).map((provider) => ({
        id: provider.id,
        enabled: true,
        model: provider.model,
        options: provider.options
    }));
}

export function listActiveProviders(settings: SettingsConfig): ProviderSettings[] {
    return listProviders(settings).filter((provider) => provider.enabled !== false);
}

export function upsertProviderSettings(
    providers: ProviderSettings[] | undefined,
    entry: ProviderSettings
): ProviderSettings[] {
    const list = providers ? [...providers] : [];
    const filtered = list.filter((provider) => provider.id !== entry.id);
    return [entry, ...filtered];
}

export function removeProviderSettings(providers: ProviderSettings[] | undefined, id: string): ProviderSettings[] {
    return (providers ?? []).filter((provider) => provider.id !== id);
}

function normalizePlugins(plugins: PluginInstanceSettings[]): PluginInstanceSettings[] {
    return plugins.map((plugin) => ({ ...plugin }));
}
