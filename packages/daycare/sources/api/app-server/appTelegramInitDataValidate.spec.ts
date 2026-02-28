import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { appTelegramInitDataValidate } from "./appTelegramInitDataValidate.js";

function telegramInitDataBuild(options: { botToken: string; userId: string; authDateSeconds: number }): string {
    const params = new URLSearchParams();
    params.set("auth_date", String(options.authDateSeconds));
    params.set("query_id", "AAEAAQ");
    params.set(
        "user",
        JSON.stringify({
            id: Number(options.userId),
            first_name: "Test"
        })
    );

    const dataCheckString = Array.from(params.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");
    const secretKey = createHmac("sha256", "WebAppData").update(options.botToken).digest();
    const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    params.set("hash", hash);
    return params.toString();
}

describe("appTelegramInitDataValidate", () => {
    it("validates signed initData and returns Telegram user id", () => {
        const nowMs = new Date("2026-02-27T10:00:00Z").getTime();
        const initData = telegramInitDataBuild({
            botToken: "bot-token-1",
            userId: "123",
            authDateSeconds: Math.floor(nowMs / 1000) - 30
        });

        const result = appTelegramInitDataValidate(initData, "bot-token-1", nowMs);
        expect(result.userId).toBe("123");
    });

    it("rejects invalid signatures", () => {
        const nowMs = new Date("2026-02-27T10:00:00Z").getTime();
        const initData = telegramInitDataBuild({
            botToken: "bot-token-1",
            userId: "123",
            authDateSeconds: Math.floor(nowMs / 1000) - 30
        });

        expect(() => appTelegramInitDataValidate(initData, "other-token", nowMs)).toThrow(
            "Telegram initData signature is invalid."
        );
    });

    it("rejects expired initData", () => {
        const nowMs = new Date("2026-02-27T10:00:00Z").getTime();
        const initData = telegramInitDataBuild({
            botToken: "bot-token-1",
            userId: "123",
            authDateSeconds: Math.floor(nowMs / 1000) - 90_000
        });

        expect(() => appTelegramInitDataValidate(initData, "bot-token-1", nowMs)).toThrow("Telegram initData expired.");
    });
});
