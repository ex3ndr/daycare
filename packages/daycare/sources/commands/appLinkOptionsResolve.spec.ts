import { describe, expect, it } from "vitest";
import { appLinkOptionsResolve } from "./appLinkOptionsResolve.js";

describe("appLinkOptionsResolve", () => {
    it("uses app server settings when present", () => {
        const resolved = appLinkOptionsResolve(
            {},
            {
                host: "0.0.0.0",
                port: 7444,
                appEndpoint: "https://app.example.com/",
                serverEndpoint: "https://api.example.com/",
                jwtSecret: "settings-secret"
            }
        );

        expect(resolved).toEqual({
            host: "0.0.0.0",
            port: 7444,
            appEndpoint: "https://app.example.com",
            serverEndpoint: "https://api.example.com",
            expiresInSeconds: 3600,
            settingsJwtSecret: "settings-secret"
        });
    });

    it("prefers CLI host and port options over settings", () => {
        const resolved = appLinkOptionsResolve(
            {
                host: "localhost",
                port: "9000",
                appEndpoint: "https://public.example.com/",
                serverEndpoint: "https://api.public.example.com/",
                expiresInSeconds: "120"
            },
            {
                host: "127.0.0.1",
                port: 7332,
                appEndpoint: "https://app.internal.example",
                serverEndpoint: "https://api.internal.example"
            }
        );

        expect(resolved.host).toBe("localhost");
        expect(resolved.port).toBe(9000);
        expect(resolved.appEndpoint).toBe("https://public.example.com");
        expect(resolved.serverEndpoint).toBe("https://api.public.example.com");
        expect(resolved.expiresInSeconds).toBe(120);
    });

    it("falls back to defaults when app server is not configured", () => {
        const resolved = appLinkOptionsResolve({}, undefined);

        expect(resolved.host).toBe("127.0.0.1");
        expect(resolved.port).toBe(7332);
        expect(resolved.appEndpoint).toBe("https://daycare.dev");
        expect(resolved.serverEndpoint).toBeUndefined();
        expect(resolved.expiresInSeconds).toBe(3600);
    });

    it("throws when endpoint value is a bare domain", () => {
        expect(() =>
            appLinkOptionsResolve(
                {
                    appEndpoint: "app.example.com"
                },
                undefined
            )
        ).toThrow("appEndpoint must be an endpoint URL");
    });
});
