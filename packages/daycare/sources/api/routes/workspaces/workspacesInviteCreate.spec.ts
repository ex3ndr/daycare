import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { workspacesInviteCreate } from "./workspacesInviteCreate.js";

describe("workspacesInviteCreate", () => {
    it("creates invite links for workspace owners", async () => {
        const result = await workspacesInviteCreate({
            ctx: contextForUser({ userId: "owner-1" }),
            nametag: "workspace-a",
            users: {
                findById: async (id: string) =>
                    id === "owner-1"
                        ? ({
                              id,
                              nametag: "owner",
                              firstName: "Owner",
                              lastName: null
                          } as never)
                        : null,
                findByNametag: async () =>
                    ({
                        id: "workspace-1",
                        nametag: "workspace-a",
                        firstName: "Product",
                        lastName: "Ops",
                        isWorkspace: true,
                        parentUserId: "owner-1"
                    }) as never
            } as never,
            workspaceMembers: {
                isMember: async () => false
            } as never,
            publicEndpoints: {
                appEndpoint: "https://app.example.com",
                serverEndpoint: "https://api.example.com"
            },
            secret: "invite-secret"
        });

        expect(result.ok).toBe(true);
        if (!result.ok) {
            throw new Error("Expected invite creation to succeed.");
        }
        expect(result.url).toContain("https://app.example.com/invite#");
        expect(result.token).toContain(".");
        expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it("rejects non-owners", async () => {
        await expect(
            workspacesInviteCreate({
                ctx: contextForUser({ userId: "member-1" }),
                nametag: "workspace-a",
                users: {
                    findById: async (id: string) => ({ id, nametag: "member" }) as never,
                    findByNametag: async () =>
                        ({
                            id: "workspace-1",
                            nametag: "workspace-a",
                            isWorkspace: true,
                            parentUserId: "owner-1"
                        }) as never
                } as never,
                workspaceMembers: {
                    isMember: async () => true
                } as never,
                publicEndpoints: {
                    appEndpoint: "https://app.example.com",
                    serverEndpoint: "https://api.example.com"
                },
                secret: "invite-secret"
            })
        ).resolves.toEqual({
            ok: false,
            error: "Only workspace owners can create invite links."
        });
    });
});
