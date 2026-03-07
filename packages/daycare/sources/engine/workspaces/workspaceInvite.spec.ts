import { describe, expect, it } from "vitest";
import { WORKSPACE_INVITE_JWT_SERVICE, workspaceInviteTokenCreate } from "./workspaceInviteTokenCreate.js";
import { workspaceInviteTokenVerify } from "./workspaceInviteTokenVerify.js";
import { workspaceInviteUrlBuild } from "./workspaceInviteUrlBuild.js";

describe("workspaceInviteTokenCreate/workspaceInviteTokenVerify", () => {
    it("creates and verifies valid invite tokens", async () => {
        const created = await workspaceInviteTokenCreate({
            workspaceId: "workspace-1",
            secret: "secret-1"
        });

        expect(created.expiresAt).toBeGreaterThan(Date.now());
        await expect(workspaceInviteTokenVerify(created.token, "secret-1")).resolves.toEqual({
            workspaceId: "workspace-1"
        });
    });

    it("rejects expired invite tokens", async () => {
        const created = await workspaceInviteTokenCreate({
            workspaceId: "workspace-1",
            secret: "secret-1",
            expiresInSeconds: -1
        });

        await expect(workspaceInviteTokenVerify(created.token, "secret-1")).rejects.toThrow();
    });

    it("rejects tampered invite tokens", async () => {
        const created = await workspaceInviteTokenCreate({
            workspaceId: "workspace-1",
            secret: "secret-1"
        });
        const [header, payload, signature] = created.token.split(".");
        if (!header || !payload || !signature) {
            throw new Error("Expected invite token to contain three segments.");
        }
        const tampered = [header, payload, `${signature.slice(0, -1)}A`].join(".");

        await expect(workspaceInviteTokenVerify(tampered, "secret-1")).rejects.toThrow();
    });

    it("uses a dedicated JWT service", async () => {
        const created = await workspaceInviteTokenCreate({
            workspaceId: "workspace-1",
            secret: "secret-1"
        });

        expect(WORKSPACE_INVITE_JWT_SERVICE).toBe("daycare.workspace-invite");
        await expect(workspaceInviteTokenVerify(created.token, "secret-1")).resolves.toEqual({
            workspaceId: "workspace-1"
        });
    });
});

describe("workspaceInviteUrlBuild", () => {
    it("builds invite URLs with hash payload metadata", () => {
        const url = workspaceInviteUrlBuild({
            appEndpoint: "https://app.example.com/",
            backendUrl: "https://api.example.com/",
            token: "invite-token",
            workspaceName: "Product Ops"
        });

        const parsed = new URL(url);
        expect(parsed.origin).toBe("https://app.example.com");
        expect(parsed.pathname).toBe("/invite");
        expect(JSON.parse(Buffer.from(parsed.hash.slice(1), "base64url").toString("utf8"))).toEqual({
            backendUrl: "https://api.example.com",
            token: "invite-token",
            kind: "workspace-invite",
            workspaceName: "Product Ops"
        });
    });
});
