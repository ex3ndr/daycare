import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { workspaceInviteTokenCreate } from "../../../engine/workspaces/workspaceInviteTokenCreate.js";
import { inviteAccept } from "./inviteAccept.js";

describe("inviteAccept", () => {
    it("joins a workspace for a valid invite token", async () => {
        const created = await workspaceInviteTokenCreate({
            workspaceId: "workspace-1",
            secret: "secret-1"
        });
        let added = false;

        const result = await inviteAccept({
            ctx: contextForUser({ userId: "member-1" }),
            body: { token: created.token },
            users: {
                findById: async (id: string) =>
                    id === "workspace-1"
                        ? ({
                              id,
                              nametag: "workspace-a",
                              isWorkspace: true,
                              workspaceOwnerId: "owner-1"
                          } as never)
                        : null
            } as never,
            workspaceMembers: {
                add: async () => {
                    added = true;
                },
                isKicked: async () => false,
                isMember: async () => false
            } as never,
            secret: "secret-1"
        });

        expect(result).toEqual({ ok: true, workspaceId: "workspace-1" });
        expect(added).toBe(true);
    });

    it("handles expired or invalid tokens", async () => {
        const expired = await workspaceInviteTokenCreate({
            workspaceId: "workspace-1",
            secret: "secret-1",
            expiresInSeconds: -1
        });

        await expect(
            inviteAccept({
                ctx: contextForUser({ userId: "member-1" }),
                body: { token: expired.token },
                users: {
                    findById: async () => null
                } as never,
                workspaceMembers: {
                    add: async () => undefined,
                    isKicked: async () => false,
                    isMember: async () => false
                } as never,
                secret: "secret-1"
            })
        ).resolves.toEqual({
            ok: false,
            error: "Invite link expired or invalid."
        });
    });

    it("is idempotent for owners and active members and rejects kicked users", async () => {
        const created = await workspaceInviteTokenCreate({
            workspaceId: "workspace-1",
            secret: "secret-1"
        });
        const users = {
            findById: async (id: string) =>
                id === "workspace-1"
                    ? ({
                          id,
                          nametag: "workspace-a",
                          isWorkspace: true,
                          workspaceOwnerId: "owner-1"
                      } as never)
                    : null
        };

        await expect(
            inviteAccept({
                ctx: contextForUser({ userId: "owner-1" }),
                body: { token: created.token },
                users: users as never,
                workspaceMembers: {
                    add: async () => undefined,
                    isKicked: async () => false,
                    isMember: async () => false
                } as never,
                secret: "secret-1"
            })
        ).resolves.toEqual({
            ok: true,
            workspaceId: "workspace-1"
        });

        await expect(
            inviteAccept({
                ctx: contextForUser({ userId: "member-1" }),
                body: { token: created.token },
                users: users as never,
                workspaceMembers: {
                    add: async () => undefined,
                    isKicked: async () => false,
                    isMember: async () => true
                } as never,
                secret: "secret-1"
            })
        ).resolves.toEqual({
            ok: true,
            workspaceId: "workspace-1"
        });

        await expect(
            inviteAccept({
                ctx: contextForUser({ userId: "member-1" }),
                body: { token: created.token },
                users: users as never,
                workspaceMembers: {
                    add: async () => undefined,
                    isKicked: async () => true,
                    isMember: async () => false
                } as never,
                secret: "secret-1"
            })
        ).resolves.toEqual({
            ok: false,
            error: "You have been removed from this workspace."
        });
    });
});
