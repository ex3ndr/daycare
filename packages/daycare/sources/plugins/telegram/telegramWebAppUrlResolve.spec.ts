import { describe, expect, it } from "vitest";
import { telegramWebAppUrlResolve } from "./telegramWebAppUrlResolve.js";

describe("telegramWebAppUrlResolve", () => {
    it("falls back to default endpoint when no settings are configured", () => {
        const result = telegramWebAppUrlResolve({}, "telegram");
        expect(result).toBe("https://daycare.dev/?backend=https%3A%2F%2Fdaycare.dev&telegramInstanceId=telegram");
    });

    it("builds a web app URL with backend and telegram instance id", () => {
        const result = telegramWebAppUrlResolve(
            {
                appServer: {
                    enabled: true,
                    appEndpoint: "https://app.example.com",
                    serverEndpoint: "https://api.example.com"
                }
            },
            "telegram-main"
        );

        expect(result).toBe(
            "https://app.example.com/?backend=https%3A%2F%2Fapi.example.com&telegramInstanceId=telegram-main"
        );
    });

    it("uses server endpoint as both app and backend when app endpoint is missing", () => {
        const result = telegramWebAppUrlResolve({ appServer: { serverEndpoint: "https://api.example.com" } }, "tg-1");

        expect(result).toBe("https://api.example.com/?backend=https%3A%2F%2Fapi.example.com&telegramInstanceId=tg-1");
    });

    it("uses default endpoint as backend when only app endpoint is set", () => {
        const result = telegramWebAppUrlResolve({ appServer: { appEndpoint: "https://app.example.com" } }, "tg-1");

        expect(result).toBe("https://app.example.com/?backend=https%3A%2F%2Fapp.example.com&telegramInstanceId=tg-1");
    });

    it("ignores non-HTTPS endpoints and falls back to default", () => {
        const result = telegramWebAppUrlResolve(
            { appServer: { appEndpoint: "http://127.0.0.1:8081", serverEndpoint: "http://127.0.0.1:7332" } },
            "telegram"
        );

        expect(result).toBe("https://daycare.dev/?backend=https%3A%2F%2Fdaycare.dev&telegramInstanceId=telegram");
    });
});
