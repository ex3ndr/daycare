import { describe, expect, it } from "vitest";

import { configSettingsParse } from "./configSettingsParse.js";

describe("configSettingsParse", () => {
    it("accepts engine.db.path", () => {
        const parsed = configSettingsParse({
            engine: {
                db: {
                    path: "/tmp/daycare/daycare.db"
                }
            }
        });

        expect(parsed.engine?.db?.path).toBe("/tmp/daycare/daycare.db");
    });

    it("accepts engine.db.url and engine.db.autoMigrate", () => {
        const parsed = configSettingsParse({
            engine: {
                db: {
                    url: "postgres://postgres:postgres@127.0.0.1:5432/daycare",
                    autoMigrate: false
                }
            }
        });

        expect(parsed.engine?.db?.url).toBe("postgres://postgres:postgres@127.0.0.1:5432/daycare");
        expect(parsed.engine?.db?.autoMigrate).toBe(false);
    });

    it("accepts non-postgres engine.db.url values", () => {
        const parsed = configSettingsParse({
            engine: {
                db: {
                    url: "mysql://localhost/daycare"
                }
            }
        });

        expect(parsed.engine?.db?.url).toBe("mysql://localhost/daycare");
    });

    it("accepts full docker settings", () => {
        const parsed = configSettingsParse({
            docker: {
                socketPath: "/var/run/docker.sock",
                runtime: "runsc",
                readOnly: true,
                unconfinedSecurity: true,
                capAdd: ["NET_ADMIN"],
                capDrop: ["MKNOD"],
                allowLocalNetworkingForUsers: ["user-1", "user-2"],
                isolatedDnsServers: ["1.1.1.1", "8.8.8.8"],
                localDnsServers: ["192.168.0.1"]
            }
        });

        expect(parsed.docker).toEqual({
            socketPath: "/var/run/docker.sock",
            runtime: "runsc",
            readOnly: true,
            unconfinedSecurity: true,
            capAdd: ["NET_ADMIN"],
            capDrop: ["MKNOD"],
            allowLocalNetworkingForUsers: ["user-1", "user-2"],
            isolatedDnsServers: ["1.1.1.1", "8.8.8.8"],
            localDnsServers: ["192.168.0.1"]
        });
    });

    it("accepts missing docker settings", () => {
        const parsed = configSettingsParse({});
        expect(parsed.docker).toBeUndefined();
    });

    it("accepts partial docker settings", () => {
        const parsed = configSettingsParse({
            docker: {
                runtime: "runsc"
            }
        });

        expect(parsed.docker).toEqual({
            runtime: "runsc"
        });
    });

    it("accepts docker local-network user allowlist", () => {
        const parsed = configSettingsParse({
            docker: {
                allowLocalNetworkingForUsers: ["user-1"]
            }
        });

        expect(parsed.docker?.allowLocalNetworkingForUsers).toEqual(["user-1"]);
    });

    it("accepts docker dns settings", () => {
        const parsed = configSettingsParse({
            docker: {
                isolatedDnsServers: ["9.9.9.9"],
                localDnsServers: ["192.168.1.1"]
            }
        });

        expect(parsed.docker?.isolatedDnsServers).toEqual(["9.9.9.9"]);
        expect(parsed.docker?.localDnsServers).toEqual(["192.168.1.1"]);
    });

    it("accepts opensandbox backend settings", () => {
        const parsed = configSettingsParse({
            sandbox: {
                backend: "opensandbox",
                resourceLimits: {
                    cpu: 6,
                    memory: "12Gi"
                }
            },
            opensandbox: {
                domain: "https://sandbox.example.com",
                apiKey: "secret",
                image: "ubuntu",
                timeoutSeconds: 300
            }
        });

        expect(parsed.sandbox).toEqual({
            backend: "opensandbox",
            resourceLimits: {
                cpu: 6,
                memory: "12Gi"
            }
        });
        expect(parsed.opensandbox).toEqual({
            domain: "https://sandbox.example.com",
            apiKey: "secret",
            image: "ubuntu",
            timeoutSeconds: 300
        });
    });

    it("rejects unknown sandbox backends", () => {
        expect(() =>
            configSettingsParse({
                sandbox: {
                    backend: "invalid"
                }
            })
        ).toThrow();
    });

    it("accepts sandbox resource limits", () => {
        const parsed = configSettingsParse({
            sandbox: {
                resourceLimits: {
                    cpu: 2.5,
                    memory: "8Gi"
                }
            }
        });

        expect(parsed.sandbox).toEqual({
            resourceLimits: {
                cpu: 2.5,
                memory: "8Gi"
            }
        });
    });

    it("accepts model role and flavor overrides", () => {
        const parsed = configSettingsParse({
            models: {
                user: "anthropic/claude-sonnet-4-5",
                task: {
                    model: "openai/gpt-5-mini",
                    reasoning: "high"
                }
            },
            modelFlavors: {
                coding: {
                    model: "openai/gpt-5-mini",
                    description: "Optimized for coding work",
                    reasoning: "medium"
                },
                research: {
                    model: "google/gemini-2.5-pro",
                    description: "Search and extraction tasks"
                }
            }
        });

        expect(parsed.models).toEqual({
            user: {
                model: "anthropic/claude-sonnet-4-5"
            },
            task: {
                model: "openai/gpt-5-mini",
                reasoning: "high"
            }
        });
        expect(parsed.modelFlavors).toEqual({
            coding: {
                model: "openai/gpt-5-mini",
                description: "Optimized for coding work",
                reasoning: "medium"
            },
            research: {
                model: "google/gemini-2.5-pro",
                description: "Search and extraction tasks"
            }
        });
    });

    it("accepts compaction limits with per-model overrides", () => {
        const parsed = configSettingsParse({
            agents: {
                emergencyContextLimit: 200_000,
                compaction: {
                    warningLimit: 160_000,
                    criticalLimit: 190_000,
                    models: {
                        "anthropic/claude-opus-4-6": {
                            emergencyLimit: 1_000_000
                        },
                        "anthropic/claude-sonnet-4-6": {
                            warningLimit: 700_000,
                            criticalLimit: 850_000
                        }
                    }
                }
            }
        });

        expect(parsed.agents).toEqual({
            emergencyContextLimit: 200_000,
            compaction: {
                warningLimit: 160_000,
                criticalLimit: 190_000,
                models: {
                    "anthropic/claude-opus-4-6": {
                        emergencyLimit: 1_000_000
                    },
                    "anthropic/claude-sonnet-4-6": {
                        warningLimit: 700_000,
                        criticalLimit: 850_000
                    }
                }
            }
        });
    });
});
