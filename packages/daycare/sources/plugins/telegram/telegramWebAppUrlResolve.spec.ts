import { describe, expect, it } from "vitest";
import { telegramWebAppUrlResolve } from "./telegramWebAppUrlResolve.js";

describe("telegramWebAppUrlResolve", () => {
    it("returns null when daycare-app-server is not enabled", () => {
        const result = telegramWebAppUrlResolve({}, "telegram");
        expect(result).toBeNull();
    });

    it("builds a web app URL with backend and telegram instance id", () => {
        const result = telegramWebAppUrlResolve(
            {
                plugins: [
                    {
                        instanceId: "daycare-app-server",
                        pluginId: "daycare-app-server",
                        enabled: true,
                        settings: {
                            appEndpoint: "https://app.example.com",
                            serverEndpoint: "https://api.example.com"
                        }
                    }
                ]
            },
            "telegram-main"
        );

        expect(result).toBe(
            "https://app.example.com/?backend=https%3A%2F%2Fapi.example.com&telegramInstanceId=telegram-main"
        );
    });
});
