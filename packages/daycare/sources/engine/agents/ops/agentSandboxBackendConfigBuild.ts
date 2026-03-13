import { sandboxResourceLimitsResolve } from "../../../sandbox/sandboxResourceLimitsResolve.js";
import type { SandboxBackendConfig } from "../../../sandbox/sandboxTypes.js";
import type { ResolvedSettingsConfig } from "../../../settings.js";

/**
 * Builds the sandbox exec backend config for a user from resolved engine settings.
 * Expects: settings have already passed config resolution and validation.
 */
export function agentSandboxBackendConfigBuild(settings: ResolvedSettingsConfig, userId: string): SandboxBackendConfig {
    const resourceLimits = sandboxResourceLimitsResolve(settings.sandbox.resourceLimits);

    if (settings.sandbox.backend === "opensandbox") {
        if (!settings.opensandbox.domain) {
            throw new Error("settings.opensandbox.domain is required when sandbox.backend is opensandbox.");
        }
        if (!settings.opensandbox.image) {
            throw new Error("settings.opensandbox.image is required when sandbox.backend is opensandbox.");
        }
        return {
            type: "opensandbox",
            opensandbox: {
                domain: settings.opensandbox.domain,
                apiKey: settings.opensandbox.apiKey,
                image: settings.opensandbox.image,
                resourceLimits: {
                    cpu: resourceLimits.cpu,
                    memory: resourceLimits.memory
                },
                userId,
                timeoutSeconds: settings.opensandbox.timeoutSeconds
            }
        };
    }

    return {
        type: "docker",
        docker: {
            socketPath: settings.docker.socketPath,
            runtime: settings.docker.runtime,
            readOnly: settings.docker.readOnly,
            unconfinedSecurity: settings.docker.unconfinedSecurity,
            capAdd: settings.docker.capAdd,
            capDrop: settings.docker.capDrop,
            allowLocalNetworkingForUsers: settings.docker.allowLocalNetworkingForUsers,
            isolatedDnsServers: settings.docker.isolatedDnsServers,
            localDnsServers: settings.docker.localDnsServers,
            resourceLimits: {
                cpu: resourceLimits.cpu,
                memory: resourceLimits.memory
            },
            userId
        }
    };
}
