import path from "node:path";

import { describe, expect, it } from "vitest";

import { configResolve } from "./configResolve.js";

describe("configResolve", () => {
    it("resolves runtime directories with usersDir under dataDir and authPath under configDir", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve(
            {
                engine: {
                    dataDir: "/tmp/daycare/.daycare"
                }
            },
            configPath
        );

        expect(config.dataDir).toBe(path.resolve("/tmp/daycare/.daycare"));
        expect(config.agentsDir).toBe(path.resolve("/tmp/daycare/.daycare/agents"));
        expect(config.usersDir).toBe(path.resolve("/tmp/daycare/.daycare/users"));
        expect(config.db.path).toBe(path.resolve("/tmp/daycare/.daycare/daycare.db"));
        expect(config.authPath).toBe(path.resolve("/tmp/daycare/auth.json"));
    });

    it("resolves engine.db.path from settings", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve(
            {
                engine: {
                    dataDir: "/tmp/daycare/.daycare",
                    db: {
                        path: "/tmp/daycare/custom/daycare.db"
                    }
                }
            },
            configPath
        );
        expect(config.db.path).toBe(path.resolve("/tmp/daycare/custom/daycare.db"));
    });

    it("defaults engine.db.url to null and auto migrations to true", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve({}, configPath);
        expect(config.db.url).toBeNull();
        expect(config.db.autoMigrate).toBe(true);
    });

    it("resolves engine.db.url and auto migration settings", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve(
            {
                engine: {
                    db: {
                        path: "/tmp/daycare/custom/daycare.db",
                        url: "postgres://postgres:postgres@127.0.0.1:5432/daycare",
                        autoMigrate: false
                    }
                }
            },
            configPath
        );
        expect(config.db.path).toBe(path.resolve("/tmp/daycare/custom/daycare.db"));
        expect(config.db.url).toBe("postgres://postgres:postgres@127.0.0.1:5432/daycare");
        expect(config.db.autoMigrate).toBe(false);
    });

    it("defaults security.appReviewerEnabled to false", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve({}, configPath);
        expect(config.settings.security.appReviewerEnabled).toBe(false);
    });

    it("defaults compaction thresholds from the emergency context limit", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve({}, configPath);

        expect(config.settings.agents).toEqual({
            emergencyContextLimit: 200_000,
            compaction: {
                emergencyLimit: 200_000,
                warningLimit: 150_000,
                criticalLimit: 180_000,
                models: {}
            }
        });
    });

    it("resolves explicit compaction settings and preserves model overrides", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve(
            {
                agents: {
                    emergencyContextLimit: 250_000,
                    compaction: {
                        emergencyLimit: 300_000,
                        warningLimit: 225_000,
                        criticalLimit: 280_000,
                        models: {
                            "anthropic/claude-opus-4-6": {
                                emergencyLimit: 1_000_000
                            }
                        }
                    }
                }
            },
            configPath
        );

        expect(config.settings.agents).toEqual({
            emergencyContextLimit: 300_000,
            compaction: {
                emergencyLimit: 300_000,
                warningLimit: 225_000,
                criticalLimit: 280_000,
                models: {
                    "anthropic/claude-opus-4-6": {
                        emergencyLimit: 1_000_000
                    }
                }
            }
        });
    });

    it("resolves security.appReviewerEnabled from settings", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve({ security: { appReviewerEnabled: false } }, configPath);
        expect(config.settings.security.appReviewerEnabled).toBe(false);
    });

    it("defaults docker settings when missing", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve({}, configPath);
        expect(config.docker).toEqual({
            socketPath: undefined,
            runtime: undefined,
            readOnly: true,
            unconfinedSecurity: false,
            capAdd: [],
            capDrop: [],
            allowLocalNetworkingForUsers: [],
            isolatedDnsServers: ["1.1.1.1", "8.8.8.8"],
            localDnsServers: []
        });
        expect(config.settings.docker).toEqual(config.docker);
    });

    it("resolves partial docker settings with defaults", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve(
            {
                docker: {
                    runtime: "runsc"
                }
            },
            configPath
        );
        expect(config.docker).toEqual({
            socketPath: undefined,
            runtime: "runsc",
            readOnly: true,
            unconfinedSecurity: false,
            capAdd: [],
            capDrop: [],
            allowLocalNetworkingForUsers: [],
            isolatedDnsServers: ["1.1.1.1", "8.8.8.8"],
            localDnsServers: []
        });
    });

    it("resolves full docker settings", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve(
            {
                docker: {
                    socketPath: "/var/run/docker.sock",
                    runtime: "runsc",
                    readOnly: true,
                    unconfinedSecurity: true,
                    capAdd: ["NET_ADMIN"],
                    capDrop: ["MKNOD"]
                }
            },
            configPath
        );
        expect(config.docker).toEqual({
            socketPath: "/var/run/docker.sock",
            runtime: "runsc",
            readOnly: true,
            unconfinedSecurity: true,
            capAdd: ["NET_ADMIN"],
            capDrop: ["MKNOD"],
            allowLocalNetworkingForUsers: [],
            isolatedDnsServers: ["1.1.1.1", "8.8.8.8"],
            localDnsServers: []
        });
    });

    it("normalizes docker capability lists", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve(
            {
                docker: {
                    capAdd: [" SYS_ADMIN ", "NET_ADMIN", "NET_ADMIN"],
                    capDrop: ["MKNOD", " MKNOD "]
                }
            },
            configPath
        );

        expect(config.docker.capAdd).toEqual(["NET_ADMIN", "SYS_ADMIN"]);
        expect(config.docker.capDrop).toEqual(["MKNOD"]);
    });

    it("normalizes docker local-network user allowlist", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve(
            {
                docker: {
                    allowLocalNetworkingForUsers: [" user-b ", "user-a", "user-a", " "]
                }
            },
            configPath
        );

        expect(config.docker.allowLocalNetworkingForUsers).toEqual(["user-a", "user-b"]);
    });

    it("normalizes docker dns server lists", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve(
            {
                docker: {
                    isolatedDnsServers: [" 9.9.9.9 ", "1.1.1.1", "9.9.9.9", " "],
                    localDnsServers: [" 192.168.1.1 ", "8.8.8.8", "192.168.1.1"]
                }
            },
            configPath
        );

        expect(config.docker.isolatedDnsServers).toEqual(["9.9.9.9", "1.1.1.1"]);
        expect(config.docker.localDnsServers).toEqual(["192.168.1.1", "8.8.8.8"]);
    });

    it("defaults sandbox backend to docker", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve({}, configPath);

        expect(config.settings.sandbox).toEqual({
            backend: "docker",
            resourceLimits: {
                cpu: 4,
                memory: "16Gi"
            }
        });
        expect(config.settings.opensandbox).toEqual({
            domain: undefined,
            apiKey: undefined,
            image: undefined,
            timeoutSeconds: 600
        });
    });

    it("resolves opensandbox settings when selected", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve(
            {
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
            },
            configPath
        );

        expect(config.settings.sandbox.backend).toBe("opensandbox");
        expect(config.settings.sandbox.resourceLimits).toEqual({
            cpu: 6,
            memory: "12Gi"
        });
        expect(config.settings.opensandbox).toEqual({
            domain: "https://sandbox.example.com",
            apiKey: "secret",
            image: "ubuntu",
            timeoutSeconds: 300
        });
    });

    it("normalizes sandbox resource limits", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve(
            {
                sandbox: {
                    resourceLimits: {
                        cpu: 2.5,
                        memory: " 8Gi "
                    }
                }
            },
            configPath
        );

        expect(config.settings.sandbox.resourceLimits).toEqual({
            cpu: 2.5,
            memory: "8Gi"
        });
    });

    it("rejects opensandbox backend without required settings", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");

        expect(() =>
            configResolve(
                {
                    sandbox: {
                        backend: "opensandbox"
                    },
                    opensandbox: {
                        image: "ubuntu"
                    }
                },
                configPath
            )
        ).toThrow("settings.opensandbox.domain is required when sandbox.backend is opensandbox.");
    });
});
