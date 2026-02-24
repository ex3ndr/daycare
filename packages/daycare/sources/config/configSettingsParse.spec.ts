import { describe, expect, it } from "vitest";

import { configSettingsParse } from "./configSettingsParse.js";

describe("configSettingsParse", () => {
    it("accepts features.noTools", () => {
        const parsed = configSettingsParse({
            features: {
                noTools: true
            }
        });

        expect(parsed.features?.noTools).toBe(true);
    });

    it("accepts engine.dbPath", () => {
        const parsed = configSettingsParse({
            engine: {
                dbPath: "/tmp/daycare/daycare.db"
            }
        });

        expect(parsed.engine?.dbPath).toBe("/tmp/daycare/daycare.db");
    });

    it("accepts full docker settings", () => {
        const parsed = configSettingsParse({
            docker: {
                enabled: true,
                image: "daycare-sandbox",
                tag: "latest",
                socketPath: "/var/run/docker.sock",
                runtime: "runsc",
                enableWeakerNestedSandbox: true,
                readOnly: true,
                unconfinedSecurity: true,
                capAdd: ["NET_ADMIN"],
                capDrop: ["MKNOD"]
            }
        });

        expect(parsed.docker).toEqual({
            enabled: true,
            image: "daycare-sandbox",
            tag: "latest",
            socketPath: "/var/run/docker.sock",
            runtime: "runsc",
            enableWeakerNestedSandbox: true,
            readOnly: true,
            unconfinedSecurity: true,
            capAdd: ["NET_ADMIN"],
            capDrop: ["MKNOD"]
        });
    });

    it("accepts missing docker settings", () => {
        const parsed = configSettingsParse({});
        expect(parsed.docker).toBeUndefined();
    });

    it("accepts partial docker settings", () => {
        const parsed = configSettingsParse({
            docker: {
                enabled: true
            }
        });

        expect(parsed.docker).toEqual({
            enabled: true
        });
    });
});
