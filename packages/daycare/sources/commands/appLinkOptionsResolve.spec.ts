import { describe, expect, it } from "vitest";
import { appLinkOptionsResolve } from "./appLinkOptionsResolve.js";

describe("appLinkOptionsResolve", () => {
    it("uses daycare-app-server plugin settings when present", () => {
        const resolved = appLinkOptionsResolve({}, [
            {
                instanceId: "daycare-app-server",
                pluginId: "daycare-app-server",
                settings: {
                    host: "0.0.0.0",
                    port: 7444,
                    publicDomain: "app.example.com",
                    jwtSecret: "plugin-secret"
                }
            }
        ]);

        expect(resolved).toEqual({
            host: "0.0.0.0",
            port: 7444,
            publicDomain: "app.example.com",
            expiresInSeconds: 3600,
            settingsJwtSecret: "plugin-secret"
        });
    });

    it("prefers CLI host and port options over plugin settings", () => {
        const resolved = appLinkOptionsResolve(
            {
                host: "localhost",
                port: "9000",
                publicDomain: "https://public.example.com",
                expiresInSeconds: "120"
            },
            [
                {
                    instanceId: "daycare-app-server",
                    pluginId: "daycare-app-server",
                    settings: {
                        host: "127.0.0.1",
                        port: 7332,
                        publicDomain: "app.internal.example"
                    }
                }
            ]
        );

        expect(resolved.host).toBe("localhost");
        expect(resolved.port).toBe(9000);
        expect(resolved.publicDomain).toBe("https://public.example.com");
        expect(resolved.expiresInSeconds).toBe(120);
    });

    it("throws when requested instance id is missing", () => {
        expect(() =>
            appLinkOptionsResolve(
                {
                    instance: "missing"
                },
                []
            )
        ).toThrow('Plugin instance "missing" was not found in settings.');
    });

    it("falls back to defaults when plugin is not configured", () => {
        const resolved = appLinkOptionsResolve({}, []);

        expect(resolved.host).toBe("127.0.0.1");
        expect(resolved.port).toBe(7332);
        expect(resolved.publicDomain).toBeUndefined();
        expect(resolved.expiresInSeconds).toBe(3600);
    });
});
