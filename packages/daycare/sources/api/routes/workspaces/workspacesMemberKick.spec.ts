import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { workspacesMemberKick } from "./workspacesMemberKick.js";

describe("workspacesMemberKick", () => {
    it("lets owners kick members with a reason", async () => {
        const kick = vi.fn(async () => undefined);
        const result = await workspacesMemberKick({
            ctx: contextForUser({ userId: "owner-1" }),
            nametag: "workspace-a",
            userId: "member-1",
            body: { reason: "cleanup" },
            users: {
                findById: async (id: string) => ({ id, nametag: id }) as never,
                findByNametag: async () =>
                    ({
                        id: "workspace-1",
                        nametag: "workspace-a",
                        isWorkspace: true,
                        workspaceOwnerId: "owner-1"
                    }) as never
            } as never,
            workspaceMembers: {
                isMember: async () => false,
                kick
            } as never
        });

        expect(result).toEqual({ ok: true });
        expect(kick).toHaveBeenCalledWith("workspace-1", "member-1", "cleanup");
    });

    it("rejects non-owners and self-kicks", async () => {
        await expect(
            workspacesMemberKick({
                ctx: contextForUser({ userId: "member-1" }),
                nametag: "workspace-a",
                userId: "member-2",
                body: { reason: "cleanup" },
                users: {
                    findById: async (id: string) => ({ id, nametag: id }) as never,
                    findByNametag: async () =>
                        ({
                            id: "workspace-1",
                            nametag: "workspace-a",
                            isWorkspace: true,
                            workspaceOwnerId: "owner-1"
                        }) as never
                } as never,
                workspaceMembers: {
                    isMember: async () => true,
                    kick: async () => undefined
                } as never
            })
        ).resolves.toEqual({
            ok: false,
            error: "Only workspace owners can manage workspace members."
        });

        await expect(
            workspacesMemberKick({
                ctx: contextForUser({ userId: "owner-1" }),
                nametag: "workspace-a",
                userId: "owner-1",
                body: {},
                users: {
                    findById: async (id: string) => ({ id, nametag: id }) as never,
                    findByNametag: async () =>
                        ({
                            id: "workspace-1",
                            nametag: "workspace-a",
                            isWorkspace: true,
                            workspaceOwnerId: "owner-1"
                        }) as never
                } as never,
                workspaceMembers: {
                    isMember: async () => false,
                    kick: async () => undefined
                } as never
            })
        ).resolves.toEqual({
            ok: false,
            error: "Owner cannot remove themselves from the workspace."
        });
    });
});
