import { describe, expect, it } from "vitest";
import { authLinkPayloadParse } from "@/modules/auth/authLinkPayloadParse";

describe("authLinkPayloadParse", () => {
    it("decodes a valid base64url payload hash", () => {
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
    });

    it("returns null for invalid hash payload", () => {
        expect(authLinkPayloadParse("#not-valid-base64")).toBeNull();
    });

    it("returns null when required fields are missing", () => {
        const encoded = Buffer.from(JSON.stringify({ token: "token-1" }), "utf8").toString("base64url");
        expect(authLinkPayloadParse(`#${encoded}`)).toBeNull();
    });
});
