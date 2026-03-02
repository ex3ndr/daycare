import { afterEach, describe, expect, it, vi } from "vitest";
import { authLinkPayloadFromUrl } from "@/modules/auth/authLinkPayloadFromUrl";

describe("authLinkPayloadFromUrl", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("parses hash payload from full URL", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const encoded = authLinkPayloadEncode({
            backendUrl: "http://127.0.0.1:7332/",
            token: "token-1"
        });

        expect(authLinkPayloadFromUrl(`https://daycare.dev/auth#${encoded}`)).toEqual({
            backendUrl: "http://127.0.0.1:7332",
            token: "token-1"
        });
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it("parses query payload for native deeplink URLs", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const encoded = authLinkPayloadEncode({
            backendUrl: "http://127.0.0.1:7332/",
            token: "token-1"
        });

        expect(authLinkPayloadFromUrl(`daycare://auth?payload=${encoded}`)).toEqual({
            backendUrl: "http://127.0.0.1:7332",
            token: "token-1"
        });
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it("prefers valid hash payload over query payload", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const hashEncoded = authLinkPayloadEncode({
            backendUrl: "http://127.0.0.1:7332/",
            token: "token-hash"
        });
        const queryEncoded = authLinkPayloadEncode({
            backendUrl: "http://127.0.0.1:7332/",
            token: "token-query"
        });

        expect(authLinkPayloadFromUrl(`daycare://auth?payload=${queryEncoded}#${hashEncoded}`)).toEqual({
            backendUrl: "http://127.0.0.1:7332",
            token: "token-hash"
        });
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it("returns null for URL without payload", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        expect(authLinkPayloadFromUrl("daycare://auth")).toBeNull();
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it("supports raw hash payload", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const encoded = authLinkPayloadEncode({
            backendUrl: "http://127.0.0.1:7332/",
            token: "token-1"
        });

        expect(authLinkPayloadFromUrl(`#${encoded}`)).toEqual({
            backendUrl: "http://127.0.0.1:7332",
            token: "token-1"
        });
        expect(warnSpy).not.toHaveBeenCalled();
    });
});

function authLinkPayloadEncode(payload: { backendUrl: string; token: string }): string {
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}
