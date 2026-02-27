import path from "node:path";

import { describe, expect, it } from "vitest";

import { configResolve } from "./configResolve.js";

describe("configResolve", () => {
    it("resolves runtime directories with usersDir under configDir", () => {
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
        expect(config.usersDir).toBe(path.resolve("/tmp/daycare/users"));
        expect(config.db.path).toBe(path.resolve("/tmp/daycare/.daycare/daycare.db"));
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

    it("resolves security.appReviewerEnabled from settings", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve({ security: { appReviewerEnabled: false } }, configPath);
        expect(config.settings.security.appReviewerEnabled).toBe(false);
    });

    it("defaults docker settings when missing", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve({}, configPath);
        expect(config.docker).toEqual({
            enabled: false,
            image: "daycare-sandbox",
            tag: "latest",
            socketPath: undefined,
            runtime: undefined,
            enableWeakerNestedSandbox: false,
            readOnly: false,
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
                    enabled: true,
                    image: "custom-sandbox"
                }
            },
            configPath
        );
        expect(config.docker).toEqual({
            enabled: true,
            image: "custom-sandbox",
            tag: "latest",
            socketPath: undefined,
            runtime: undefined,
            enableWeakerNestedSandbox: false,
            readOnly: false,
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
                    enabled: true,
                    image: "daycare-sandbox",
                    tag: "v2",
                    socketPath: "/var/run/docker.sock",
                    runtime: "runsc",
                    enableWeakerNestedSandbox: true,
                    readOnly: true,
                    unconfinedSecurity: true,
                    capAdd: ["NET_ADMIN"],
                    capDrop: ["MKNOD"]
                }
            },
            configPath
        );
        expect(config.docker).toEqual({
            enabled: true,
            image: "daycare-sandbox",
            tag: "v2",
            socketPath: "/var/run/docker.sock",
            runtime: "runsc",
            enableWeakerNestedSandbox: true,
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
});
