import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { profileEmailConnectRequest } from "./profileEmailConnectRequest.js";

describe("profileEmailConnectRequest", () => {
    it("rejects missing email", async () => {
        const result = await profileEmailConnectRequest({
            ctx: contextForUser({ userId: "user-1" }),
            request: vi.fn(async () => undefined),
            body: {}
        });

        expect(result).toEqual({ ok: false, error: "Email is required." });
    });

    it("returns unavailable when request handler is missing", async () => {
        const result = await profileEmailConnectRequest({
            ctx: contextForUser({ userId: "user-1" }),
            request: null,
            body: { email: "person@example.com" }
        });

        expect(result).toEqual({ ok: false, error: "Email connection is unavailable." });
    });

    it("passes the authenticated user id to the request handler", async () => {
        const request = vi.fn(async () => undefined);
        const result = await profileEmailConnectRequest({
            ctx: contextForUser({ userId: "user-1" }),
            request,
            body: { email: "person@example.com" }
        });

        expect(result).toEqual({ ok: true });
        expect(request).toHaveBeenCalledWith("user-1", "person@example.com");
    });
});
