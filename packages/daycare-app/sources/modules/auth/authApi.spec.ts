import { afterEach, describe, expect, it, vi } from "vitest";
import { authTelegramExchange, authValidateToken } from "@/modules/auth/authApi";

describe("authValidateToken", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns userId for valid token", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: true, userId: "user-1" })
            }))
        );

        await expect(authValidateToken("http://localhost:7332", "token-1")).resolves.toEqual({
            ok: true,
            userId: "user-1"
        });
    });

    it("returns error for invalid token", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: false, error: "expired" })
            }))
        );

        await expect(authValidateToken("http://localhost:7332", "token-1")).resolves.toEqual({
            ok: false,
            error: "expired"
        });
    });
});

describe("authTelegramExchange", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns token and userId when Telegram auth succeeds", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: true, userId: "123", token: "jwt-1" })
            }))
        );

        await expect(authTelegramExchange("http://localhost:7332", "init-data", "telegram-main")).resolves.toEqual({
            ok: true,
            userId: "123",
            token: "jwt-1"
        });
    });

    it("returns error when Telegram auth fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: false, error: "invalid initData" })
            }))
        );

        await expect(authTelegramExchange("http://localhost:7332", "init-data")).resolves.toEqual({
            ok: false,
            error: "invalid initData"
        });
    });
});
