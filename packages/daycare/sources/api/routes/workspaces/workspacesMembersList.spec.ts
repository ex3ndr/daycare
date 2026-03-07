import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { workspacesMembersList } from "./workspacesMembersList.js";

describe("workspacesMembersList", () => {
    it("includes the owner and active members", async () => {
        const result = await workspacesMembersList({
            ctx: contextForUser({ userId: "member-1" }),
            nametag: "workspace-a",
            users: {
                findById: async (id: string) => {
                    if (id === "member-1") {
                        return { id, nametag: "member-1" } as never;
                    }
                    if (id === "owner-1") {
                        return {
                            id,
                            nametag: "owner",
                            firstName: "Owner",
                            lastName: "User"
                        } as never;
                    }
                    if (id === "workspace-1") {
                        return {
                            id,
                            nametag: "workspace-a",
                            firstName: "Workspace",
                            lastName: null,
                            isWorkspace: true,
                            parentUserId: "owner-1",
                            createdAt: 10
                        } as never;
                    }
                    if (id === "member-2") {
                        return {
                            id,
                            nametag: "member-two",
                            firstName: "Member",
                            lastName: "Two"
                        } as never;
                    }
                    return null;
                },
                findByNametag: async () =>
                    ({
                        id: "workspace-1",
                        nametag: "workspace-a",
                        firstName: "Workspace",
                        lastName: null,
                        isWorkspace: true,
                        parentUserId: "owner-1",
                        createdAt: 10
                    }) as never
            } as never,
            workspaceMembers: {
                isMember: async () => true,
                findByWorkspace: async () => [
                    {
                        id: 1,
                        workspaceId: "workspace-1",
                        userId: "member-2",
                        joinedAt: 20,
                        leftAt: null,
                        kickReason: null
                    }
                ]
            } as never
        });

        expect(result).toEqual({
            ok: true,
            members: [
                {
                    userId: "owner-1",
                    nametag: "owner",
                    firstName: "Owner",
                    lastName: "User",
                    joinedAt: 10,
                    isOwner: true
                },
                {
                    userId: "member-2",
                    nametag: "member-two",
                    firstName: "Member",
                    lastName: "Two",
                    joinedAt: 20,
                    isOwner: false
                }
            ]
        });
    });
});
