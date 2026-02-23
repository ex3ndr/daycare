import type { ResolvedDockerSettings, ResolvedFeaturesConfig, ResolvedSettingsConfig } from "../settings.js";

export type Config = {
    settingsPath: string;
    configDir: string;
    dataDir: string;
    agentsDir: string;
    usersDir: string;
    dbPath: string;
    authPath: string;
    socketPath: string;
    docker: ResolvedDockerSettings;
    features: ResolvedFeaturesConfig;
    settings: ResolvedSettingsConfig;
    verbose: boolean;
};

export type ConfigOverrides = {
    verbose?: boolean;
};
