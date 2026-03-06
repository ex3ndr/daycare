import { describe, expect, it } from "vitest";
import { authTelegramWebAppContextParse } from "@/modules/auth/authTelegramWebAppContextParse";

describe("authTelegramWebAppContextParse", () => {
    it("returns parsed backend, initData, and telegram instance id from query params", () => {
        const result = authTelegramWebAppContextParse(
            "https://app.example.com?backend=https%3A%2F%2Fapi.example.com%2F&telegramInstanceId=telegram-main",
            "init-data-value"
        );

        expect(result).toEqual({
            backendUrl: "https://api.example.com",
            initData: "init-data-value",
            telegramInstanceId: "telegram-main"
        });
    });

    it("returns parsed backend from hash fragment when not in query params", () => {
        const result = authTelegramWebAppContextParse(
            "https://app.example.com#tgWebAppData=foo&backend=https%3A%2F%2Fapi.example.com%2F&telegramInstanceId=tg-1",
            "init-data-value"
        );

        expect(result).toEqual({
            backendUrl: "https://api.example.com",
            initData: "init-data-value",
            telegramInstanceId: "tg-1"
        });
    });

    it("prefers query params over hash fragment", () => {
        const result = authTelegramWebAppContextParse(
            "https://app.example.com?backend=https%3A%2F%2Fquery.example.com#backend=https%3A%2F%2Fhash.example.com",
            "init-data-value"
        );

        expect(result).toEqual({
            backendUrl: "https://query.example.com",
            initData: "init-data-value",
            telegramInstanceId: "telegram"
        });
    });

    it("falls back to rawLaunchParams when backend is missing from href", () => {
        const result = authTelegramWebAppContextParse(
            "https://app.example.com/",
            "init-data-value",
            "backend=https%3A%2F%2Fapi.example.com&telegramInstanceId=tg-1&tgWebAppData=foo"
        );

        expect(result).toEqual({
            backendUrl: "https://api.example.com",
            initData: "init-data-value",
            telegramInstanceId: "tg-1"
        });
    });

    it("uses default backend and telegram instance id when launch params omit both", () => {
        expect(authTelegramWebAppContextParse("https://app.example.com?foo=bar", "init-data-value")).toEqual({
            backendUrl: "https://api.daycare.dev",
            initData: "init-data-value",
            telegramInstanceId: "telegram"
        });
    });

    it("uses default telegram instance id when backend is provided without it", () => {
        expect(
            authTelegramWebAppContextParse("https://app.example.com?backend=https%3A%2F%2Fapi.example.com", "init-data")
        ).toEqual({
            backendUrl: "https://api.example.com",
            initData: "init-data",
            telegramInstanceId: "telegram"
        });
    });

    it("returns null when backend param is present but invalid", () => {
        expect(authTelegramWebAppContextParse("https://app.example.com?backend=not-a-url", "init-data")).toBeNull();
    });

    it("returns null when initData is empty", () => {
        expect(
            authTelegramWebAppContextParse("https://app.example.com?backend=https%3A%2F%2Fapi.example.com", "   ")
        ).toBeNull();
    });
});
