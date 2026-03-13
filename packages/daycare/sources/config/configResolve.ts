import path from "node:path";

import { resolveEngineSocketPath } from "../engine/ipc/socket.js";
import { DEFAULT_DAYCARE_DIR } from "../paths.js";
import { sandboxResourceLimitsResolve } from "../sandbox/sandboxResourceLimitsResolve.js";
import type {
    DockerSettings,
    OpenSandboxSettings,
    ResolvedSettingsConfig,
    SandboxSettings,
    SettingsConfig
} from "../settings.js";
import { freezeDeep } from "../utils/freezeDeep.js";
import type { Config, ConfigOverrides } from "./configTypes.js";

const DEFAULT_DOCKER_ISOLATED_DNS_SERVERS = ["1.1.1.1", "8.8.8.8"];
const DEFAULT_OPENSANDBOX_TIMEOUT_SECONDS = 600;

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
    const usersDir = path.join(dataDir, "users");
    const databasePath = path.resolve(resolvedSettings.engine?.db?.path ?? path.join(dataDir, "daycare.db"));
    const databaseUrl = configDatabaseUrlResolve(resolvedSettings.engine?.db?.url);
    const databaseAutoMigrate = resolvedSettings.engine?.db?.autoMigrate ?? true;
    const authPath = path.join(configDir, "auth.json");
    const socketPath = resolveEngineSocketPath(resolvedSettings.engine?.socketPath);
    const frozenSettings = freezeDeep(structuredClone(resolvedSettings));
    const verbose = overrides.verbose ?? false;

    return freezeDeep({
        settingsPath: resolvedSettingsPath,
        configDir,
        dataDir,
        agentsDir,
        usersDir,
        db: {
            path: databasePath,
            url: databaseUrl,
            autoMigrate: databaseAutoMigrate
        },
        authPath,
        socketPath,
        docker: frozenSettings.docker,
        settings: frozenSettings,
        verbose
    });
}

function resolveSettingsDefaults(settings: SettingsConfig): ResolvedSettingsConfig {
    const emergencyContextLimit = settings.agents?.emergencyContextLimit ?? 200_000;
    const appReviewerEnabled = settings.security?.appReviewerEnabled ?? false;
    const docker = resolveDockerDefaults(settings.docker);
    const sandbox = resolveSandboxDefaults(settings.sandbox);
    const opensandbox = resolveOpenSandboxDefaults(settings.opensandbox);
    sandboxOpenSandboxConfigAssert(sandbox.backend, opensandbox);
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
        docker,
        sandbox,
        opensandbox
    };
}

function resolveDockerDefaults(docker: DockerSettings | undefined): ResolvedSettingsConfig["docker"] {
    return {
        socketPath: docker?.socketPath,
        runtime: docker?.runtime,
        readOnly: docker?.readOnly ?? true,
        unconfinedSecurity: docker?.unconfinedSecurity ?? false,
        capAdd: dockerCapabilityListNormalize(docker?.capAdd),
        capDrop: dockerCapabilityListNormalize(docker?.capDrop),
        allowLocalNetworkingForUsers: dockerUserIdListNormalize(docker?.allowLocalNetworkingForUsers),
        isolatedDnsServers: dockerDnsListNormalize(docker?.isolatedDnsServers, DEFAULT_DOCKER_ISOLATED_DNS_SERVERS),
        localDnsServers: dockerDnsListNormalize(docker?.localDnsServers, [])
    };
}

function dockerCapabilityListNormalize(input: string[] | undefined): string[] {
    if (!input || input.length === 0) {
        return [];
    }
    return Array.from(
        new Set(
            input
                .map((entry) => entry.trim())
                .filter((entry) => entry.length > 0)
                .sort()
        )
    );
}

function dockerUserIdListNormalize(input: string[] | undefined): string[] {
    if (!input || input.length === 0) {
        return [];
    }
    return Array.from(
        new Set(
            input
                .map((entry) => entry.trim())
                .filter((entry) => entry.length > 0)
                .sort()
        )
    );
}

function dockerDnsListNormalize(input: string[] | undefined, fallback: string[]): string[] {
    const source = input && input.length > 0 ? input : fallback;
    if (source.length === 0) {
        return [];
    }
    const seen = new Set<string>();
    const result: string[] = [];
    for (const entry of source) {
        const normalized = entry.trim();
        if (normalized.length === 0 || seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        result.push(normalized);
    }
    return result;
}

function configDatabaseUrlResolve(input: string | undefined): string | null {
    if (!input) {
        return null;
    }
    const trimmed = input.trim();
    if (trimmed.length === 0) {
        return null;
    }
    return trimmed;
}

function resolveSandboxDefaults(sandbox: SandboxSettings | undefined): ResolvedSettingsConfig["sandbox"] {
    const resourceLimits = sandboxResourceLimitsResolve(sandbox?.resourceLimits);

    return {
        backend: sandbox?.backend ?? "docker",
        resourceLimits: {
            cpu: resourceLimits.cpu,
            memory: resourceLimits.memory
        }
    };
}

function resolveOpenSandboxDefaults(
    opensandbox: OpenSandboxSettings | undefined
): ResolvedSettingsConfig["opensandbox"] {
    return {
        domain: configStringOrUndefined(opensandbox?.domain),
        apiKey: configStringOrUndefined(opensandbox?.apiKey),
        image: configStringOrUndefined(opensandbox?.image),
        timeoutSeconds: opensandbox?.timeoutSeconds ?? DEFAULT_OPENSANDBOX_TIMEOUT_SECONDS
    };
}

function sandboxOpenSandboxConfigAssert(
    backend: ResolvedSettingsConfig["sandbox"]["backend"],
    opensandbox: ResolvedSettingsConfig["opensandbox"]
): void {
    if (backend !== "opensandbox") {
        return;
    }
    if (!opensandbox.domain) {
        throw new Error("settings.opensandbox.domain is required when sandbox.backend is opensandbox.");
    }
    if (!opensandbox.image) {
        throw new Error("settings.opensandbox.image is required when sandbox.backend is opensandbox.");
    }
}

function configStringOrUndefined(input: string | undefined): string | undefined {
    if (!input) {
        return undefined;
    }
    const trimmed = input.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
