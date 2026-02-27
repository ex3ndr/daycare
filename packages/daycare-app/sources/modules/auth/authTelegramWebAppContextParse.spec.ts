import { describe, expect, it } from "vitest";
import { authTelegramWebAppContextParse } from "@/modules/auth/authTelegramWebAppContextParse";

describe("authTelegramWebAppContextParse", () => {
    it("returns parsed backend, initData, and telegram instance id", () => {
        const result = authTelegramWebAppContextParse(
            "?backend=https%3A%2F%2Fapi.example.com%2F&telegramInstanceId=telegram-main",
            "init-data-value"
        );

        expect(result).toEqual({
            backendUrl: "https://api.example.com",
            initData: "init-data-value",
            telegramInstanceId: "telegram-main"
        });
    });

    it("returns null when backend query param is missing", () => {
        expect(authTelegramWebAppContextParse("?foo=bar", "init-data-value")).toBeNull();
    });

    it("returns null when initData is empty", () => {
        expect(authTelegramWebAppContextParse("?backend=https%3A%2F%2Fapi.example.com", "   ")).toBeNull();
    });
});
