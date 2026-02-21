import path from "node:path";

import { resolveEngineSocketPath } from "../engine/ipc/socket.js";
import { DEFAULT_DAYCARE_DIR } from "../paths.js";
import type { ResolvedSettingsConfig, SettingsConfig } from "../settings.js";
import { freezeDeep } from "../util/freezeDeep.js";
import type { Config, ConfigOverrides } from "./configTypes.js";

/**
 * Resolves derived paths and defaults into an immutable Config snapshot.
 * Expects: settingsPath is absolute; settings already validated.
 */
export function configResolve(settings: SettingsConfig, settingsPath: string, overrides: ConfigOverrides = {}): Config {
    const resolvedSettings = resolveSettingsDefaults(settings);
    const resolvedSettingsPath = path.resolve(settingsPath);
    const configDir = path.dirname(resolvedSettingsPath);
    const dataDir = path.resolve(resolvedSettings.engine?.dataDir ?? DEFAULT_DAYCARE_DIR);
    const agentsDir = path.join(dataDir, "agents");
    const usersDir = path.join(configDir, "users");
    const dbPath = path.resolve(resolvedSettings.engine?.dbPath ?? path.join(dataDir, "daycare.db"));
    const authPath = path.join(dataDir, "auth.json");
    const socketPath = resolveEngineSocketPath(resolvedSettings.engine?.socketPath);
    const frozenSettings = freezeDeep(structuredClone(resolvedSettings));
    const verbose = overrides.verbose ?? false;

    return freezeDeep({
        settingsPath: resolvedSettingsPath,
        configDir,
        dataDir,
        agentsDir,
        usersDir,
        dbPath,
        authPath,
        socketPath,
        features: frozenSettings.features,
        settings: frozenSettings,
        verbose
    });
}

function resolveSettingsDefaults(settings: SettingsConfig): ResolvedSettingsConfig {
    const emergencyContextLimit = settings.agents?.emergencyContextLimit ?? 200_000;
    const appReviewerEnabled = settings.security?.appReviewerEnabled ?? false;
    return {
        ...settings,
        agents: {
            ...settings.agents,
            emergencyContextLimit
        },
        security: {
            ...settings.security,
            appReviewerEnabled
        },
        features: {
            say: settings.features?.say ?? false,
            rlm: settings.features?.rlm ?? false,
            noTools: settings.features?.noTools ?? false
        }
    };
}
