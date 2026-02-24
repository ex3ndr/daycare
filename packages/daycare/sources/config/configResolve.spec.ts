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
        expect(config.dbPath).toBe(path.resolve("/tmp/daycare/.daycare/daycare.db"));
    });

    it("resolves dbPath from settings", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve(
            {
                engine: {
                    dataDir: "/tmp/daycare/.daycare",
                    dbPath: "/tmp/daycare/custom/daycare.db"
                }
            },
            configPath
        );
        expect(config.dbPath).toBe(path.resolve("/tmp/daycare/custom/daycare.db"));
    });

    it("defaults features to all false", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve({}, configPath);
        expect(config.features).toEqual({ say: false, rlm: false, noTools: false });
    });

    it("resolves features.rlm from settings", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve({ features: { rlm: true } }, configPath);
        expect(config.features.rlm).toBe(true);
        expect(config.features.say).toBe(false);
        expect(config.features.noTools).toBe(false);
    });

    it("resolves features.say from settings", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve({ features: { say: true } }, configPath);
        expect(config.features.say).toBe(true);
        expect(config.features.rlm).toBe(false);
        expect(config.features.noTools).toBe(false);
    });

    it("resolves features.noTools from settings", () => {
        const configPath = path.join("/tmp/daycare", "settings.json");
        const config = configResolve({ features: { noTools: true } }, configPath);
        expect(config.features.noTools).toBe(true);
        expect(config.features.say).toBe(false);
        expect(config.features.rlm).toBe(false);
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
            unconfinedSecurity: false
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
            unconfinedSecurity: false
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
                    unconfinedSecurity: true
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
            unconfinedSecurity: true
        });
    });
});
