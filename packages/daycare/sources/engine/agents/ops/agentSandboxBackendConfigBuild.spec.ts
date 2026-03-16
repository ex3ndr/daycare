import { describe, expect, it } from "vitest";

import type { ResolvedSettingsConfig } from "../../../settings.js";
import { agentSandboxBackendConfigBuild } from "./agentSandboxBackendConfigBuild.js";

describe("agentSandboxBackendConfigBuild", () => {
    it("builds docker backend config by default", () => {
        const result = agentSandboxBackendConfigBuild(settingsBuild(), "user-1");

        expect(result).toEqual({
            type: "docker",
            docker: expect.objectContaining({
                userId: "user-1",
                runtime: "runsc",
                resourceLimits: {
                    cpu: 4,
                    memory: "16Gi"
                }
            })
        });
    });

    it("builds opensandbox backend config when selected", () => {
        const result = agentSandboxBackendConfigBuild(
            settingsBuild({
                sandbox: {
                    backend: "opensandbox",
                    resourceLimits: {
                        cpu: 4,
                        memory: "16Gi"
                    }
                },
                opensandbox: {
                    domain: "localhost:8080",
                    apiKey: "secret",
                    image: "ubuntu",
                    timeoutSeconds: 300
                }
            }),
            "user-1"
        );

        expect(result).toEqual({
            type: "opensandbox",
            opensandbox: {
                domain: "localhost:8080",
                apiKey: "secret",
                image: "ubuntu",
                resourceLimits: {
                    cpu: 4,
                    memory: "16Gi"
                },
                userId: "user-1",
                timeoutSeconds: 300
            }
        });
    });
});

function settingsBuild(overrides: Partial<ResolvedSettingsConfig> = {}): ResolvedSettingsConfig {
    return {
        agents: {
            emergencyContextLimit: 200_000,
            compaction: {
                emergencyLimit: 200_000,
                warningLimit: 150_000,
                criticalLimit: 180_000,
                models: {}
            }
        },
        security: {
            appReviewerEnabled: false
        },
        docker: {
            socketPath: undefined,
            runtime: "runsc",
            readOnly: true,
            unconfinedSecurity: false,
            capAdd: [],
            capDrop: [],
            allowLocalNetworkingForUsers: [],
            isolatedDnsServers: ["1.1.1.1"],
            localDnsServers: []
        },
        sandbox: {
            backend: "docker",
            resourceLimits: {
                cpu: 4,
                memory: "16Gi"
            }
        },
        opensandbox: {
            domain: undefined,
            apiKey: undefined,
            image: undefined,
            timeoutSeconds: 600
        },
        ...overrides
    };
}
