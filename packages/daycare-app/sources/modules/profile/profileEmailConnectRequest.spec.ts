import { afterEach, describe, expect, it, vi } from "vitest";
import { profileEmailConnectRequest } from "./profileEmailConnectRequest";

describe("profileEmailConnectRequest", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns ok when the request succeeds", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: true })
            }))
        );

        await expect(
            profileEmailConnectRequest("http://localhost:7332", "jwt-1", "person@example.com")
        ).resolves.toEqual({ ok: true });
    });

    it("returns error when the request fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: false, error: "already connected" })
            }))
        );

        await expect(
            profileEmailConnectRequest("http://localhost:7332", "jwt-1", "person@example.com")
        ).resolves.toEqual({
            ok: false,
            error: "already connected"
        });
    });
});
