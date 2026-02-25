import { afterEach, describe, expect, it, vi } from "vitest";
import { authValidateToken } from "@/modules/auth/authApi";

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
