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
                    appEndpoint: "https://app.example.com/",
                    serverDomain: "https://api.example.com/",
                    jwtSecret: "plugin-secret"
                }
            }
        ]);

        expect(resolved).toEqual({
            host: "0.0.0.0",
            port: 7444,
            appEndpoint: "https://app.example.com",
            serverDomain: "https://api.example.com",
            expiresInSeconds: 3600,
            settingsJwtSecret: "plugin-secret"
        });
    });

    it("prefers CLI host and port options over plugin settings", () => {
        const resolved = appLinkOptionsResolve(
            {
                host: "localhost",
                port: "9000",
                appEndpoint: "https://public.example.com/",
                serverDomain: "https://api.public.example.com/",
                expiresInSeconds: "120"
            },
            [
                {
                    instanceId: "daycare-app-server",
                    pluginId: "daycare-app-server",
                    settings: {
                        host: "127.0.0.1",
                        port: 7332,
                        appEndpoint: "https://app.internal.example",
                        serverDomain: "https://api.internal.example"
                    }
                }
            ]
        );

        expect(resolved.host).toBe("localhost");
        expect(resolved.port).toBe(9000);
        expect(resolved.appEndpoint).toBe("https://public.example.com");
        expect(resolved.serverDomain).toBe("https://api.public.example.com");
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
        expect(resolved.appEndpoint).toBe("https://daycare.dev");
        expect(resolved.serverDomain).toBeUndefined();
        expect(resolved.expiresInSeconds).toBe(3600);
    });

    it("throws when endpoint value is a bare domain", () => {
        expect(() =>
            appLinkOptionsResolve(
                {
                    appEndpoint: "app.example.com"
                },
                []
            )
        ).toThrow("appEndpoint must be an endpoint URL");
    });
});
