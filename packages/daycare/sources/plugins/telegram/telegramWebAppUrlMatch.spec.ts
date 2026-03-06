import { describe, expect, it } from "vitest";
import { telegramWebAppUrlMatch } from "./telegramWebAppUrlMatch.js";

describe("telegramWebAppUrlMatch", () => {
    it("matches default daycare frontend links", () => {
        expect(telegramWebAppUrlMatch("https://daycare.dev/auth#token")).toBe(true);
    });

    it("matches configured Telegram app frontend links", () => {
        expect(
            telegramWebAppUrlMatch(
                "https://app.example.com/auth#token",
                "https://app.example.com/?backend=https%3A%2F%2Fapi.example.com&telegramInstanceId=telegram"
            )
        ).toBe(true);
    });

    it("rejects unrelated origins", () => {
        expect(
            telegramWebAppUrlMatch(
                "https://example.com/auth#token",
                "https://app.example.com/?backend=https%3A%2F%2Fapi.example.com&telegramInstanceId=telegram"
            )
        ).toBe(false);
    });
});
