import type { ResolvedDockerSettings, ResolvedSettingsConfig } from "../settings.js";

export type Config = {
    settingsPath: string;
    configDir: string;
    dataDir: string;
    agentsDir: string;
    usersDir: string;
    db: {
        path: string;
        url: string | null;
        autoMigrate: boolean;
    };
    authPath: string;
    socketPath: string;
    docker: ResolvedDockerSettings;
    settings: ResolvedSettingsConfig;
    verbose: boolean;
};

export type ConfigOverrides = {
    verbose?: boolean;
};
