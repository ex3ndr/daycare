import { describe, expect, it } from "vitest";
import { telegramUrlOpenAppFlag } from "./telegramUrlOpenAppFlag.js";

describe("telegramUrlOpenAppFlag", () => {
    it("sets openApp flag for default daycare frontend links", () => {
        const result = telegramUrlOpenAppFlag("https://daycare.dev/auth#token");
        expect(result).toBe("https://daycare.dev/auth?openApp=1#token");
    });

    it("sets openApp flag for configured Telegram app frontend links", () => {
        const result = telegramUrlOpenAppFlag(
            "https://app.example.com/auth#token",
            "https://app.example.com/?backend=https%3A%2F%2Fapi.example.com&telegramInstanceId=telegram"
        );
        expect(result).toBe("https://app.example.com/auth?openApp=1#token");
    });

    it("does not modify non-app links", () => {
        const result = telegramUrlOpenAppFlag(
            "https://google.com?q=daycare",
            "https://app.example.com/?backend=https%3A%2F%2Fapi.example.com&telegramInstanceId=telegram"
        );
        expect(result).toBe("https://google.com?q=daycare");
    });
});
