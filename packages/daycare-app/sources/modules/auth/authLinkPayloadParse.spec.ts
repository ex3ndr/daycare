import { afterEach, describe, expect, it, vi } from "vitest";
import { authLinkPayloadParse } from "@/modules/auth/authLinkPayloadParse";

describe("authLinkPayloadParse", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("decodes a valid base64url payload hash", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const encoded = Buffer.from(
            JSON.stringify({
                backendUrl: "http://127.0.0.1:7332/",
                token: "token-1"
            }),
            "utf8"
        ).toString("base64url");

        expect(authLinkPayloadParse(`#${encoded}`)).toEqual({
            backendUrl: "http://127.0.0.1:7332",
            token: "token-1"
        });
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it("returns null for invalid hash payload", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        expect(authLinkPayloadParse("#%%")).toBeNull();
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining("invalid login link reason=invalid-base64-payload")
        );
    });

    it("returns null when required fields are missing", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const encoded = Buffer.from(JSON.stringify({ token: "token-1" }), "utf8").toString("base64url");
        expect(authLinkPayloadParse(`#${encoded}`)).toBeNull();
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("missing-required-fields"));
    });
});
