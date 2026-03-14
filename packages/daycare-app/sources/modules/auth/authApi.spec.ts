import { afterEach, describe, expect, it, vi } from "vitest";
import {
    authEmailConnectVerify,
    authEmailRequest,
    authEmailVerify,
    authTelegramExchange,
    authValidateToken
} from "@/modules/auth/authApi";

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

    it("returns exchanged token when validate response includes it", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: true, userId: "user-1", token: "session-token" })
            }))
        );

        await expect(authValidateToken("http://localhost:7332", "token-1")).resolves.toEqual({
            ok: true,
            userId: "user-1",
            token: "session-token"
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

describe("authEmailRequest", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns ok when email request succeeds", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: true, expiresAt: 1234, retryAfterMs: 30_000 })
            }))
        );

        await expect(authEmailRequest("http://localhost:7332", "person@example.com")).resolves.toEqual({
            ok: true,
            expiresAt: 1234,
            retryAfterMs: 30_000
        });
    });

    it("returns error when email request fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: false, error: "smtp unavailable" })
            }))
        );

        await expect(authEmailRequest("http://localhost:7332", "person@example.com")).resolves.toEqual({
            ok: false,
            error: "smtp unavailable"
        });
    });
});

describe("authEmailVerify", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns token and userId when email verify succeeds", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: true, userId: "user-9", token: "jwt-9" })
            }))
        );

        await expect(authEmailVerify("http://localhost:7332", "person@example.com", "123456")).resolves.toEqual({
            ok: true,
            userId: "user-9",
            token: "jwt-9"
        });
    });

    it("returns error when email verify fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: false, error: "EXPIRED_TOKEN" })
            }))
        );

        await expect(authEmailVerify("http://localhost:7332", "person@example.com", "123456")).resolves.toEqual({
            ok: false,
            error: "EXPIRED_TOKEN"
        });
    });
});

describe("authEmailConnectVerify", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns connected email details when verification succeeds", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: true, userId: "user-9", email: "person@example.com" })
            }))
        );

        await expect(authEmailConnectVerify("http://localhost:7332", "magic-token")).resolves.toEqual({
            ok: true,
            userId: "user-9",
            email: "person@example.com"
        });
    });

    it("returns error when verification fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: false, error: "INVALID_TOKEN" })
            }))
        );

        await expect(authEmailConnectVerify("http://localhost:7332", "magic-token")).resolves.toEqual({
            ok: false,
            error: "INVALID_TOKEN"
        });
    });
});
