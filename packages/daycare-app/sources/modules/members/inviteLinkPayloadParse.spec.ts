import { describe, expect, it } from "vitest";
import { inviteLinkPayloadFromUrl } from "./inviteLinkPayloadFromUrl";
import { inviteLinkPayloadParse } from "./inviteLinkPayloadParse";

function payloadEncode(payload: Record<string, unknown>): string {
    return btoa(JSON.stringify(payload)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

describe("inviteLinkPayloadParse", () => {
    it("parses workspace invite hash payloads", () => {
        expect(
            inviteLinkPayloadParse(
                `#${payloadEncode({
                    backendUrl: "https://api.example.com",
                    token: "invite-token",
                    kind: "workspace-invite",
                    workspaceName: "Product Ops"
                })}`
            )
        ).toEqual({
            backendUrl: "https://api.example.com",
            token: "invite-token",
            kind: "workspace-invite",
            workspaceName: "Product Ops"
        });
    });

    it("reads workspace invites from URLs and query params", () => {
        const encoded = payloadEncode({
            backendUrl: "https://api.example.com",
            token: "invite-token",
            kind: "workspace-invite"
        });

        expect(inviteLinkPayloadFromUrl(`https://app.example.com/invite#${encoded}`)).toEqual({
            backendUrl: "https://api.example.com",
            token: "invite-token",
            kind: "workspace-invite"
        });
        expect(
            inviteLinkPayloadFromUrl(
                "/invite?backendUrl=https%3A%2F%2Fapi.example.com&token=invite-token&kind=workspace-invite&workspaceName=Ops"
            )
        ).toEqual({
            backendUrl: "https://api.example.com",
            token: "invite-token",
            kind: "workspace-invite",
            workspaceName: "Ops"
        });
    });
});
