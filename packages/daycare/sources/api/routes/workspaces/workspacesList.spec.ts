import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { workspacesList } from "./workspacesList.js";

describe("workspacesList", () => {
    it("returns self, owned workspaces, and joined workspaces", async () => {
        const result = await workspacesList({
            ctx: contextForUser({ userId: "caller-1" }),
            users: {
                findById: async (id: string) => {
                    if (id === "caller-1") {
                        return {
                            id,
                            nametag: "caller",
                            firstName: "Caller",
                            lastName: null,
                            emoji: null,
                            isWorkspace: false
                        };
                    }
                    if (id === "workspace-owned" || id === "workspace-joined") {
                        return {
                            id,
                            nametag: id === "workspace-owned" ? "owned-space" : "joined-space",
                            firstName: id === "workspace-owned" ? "Owned" : "Joined",
                            lastName: null,
                            emoji: null,
                            isWorkspace: true
                        };
                    }
                    return null;
                },
                findByParentUserId: async () => [
                    {
                        id: "workspace-owned",
                        nametag: "owned-space",
                        firstName: "Owned",
                        lastName: null,
                        emoji: null,
                        isWorkspace: true
                    }
                ]
            } as never,
            workspaceMembers: {
                findByUser: async () => [
                    {
                        workspaceId: "workspace-joined",
                        userId: "caller-1",
                        joinedAt: 1,
                        id: 1,
                        leftAt: null,
                        kickReason: null
                    }
                ]
            } as never
        });

        expect(result).toEqual({
            ok: true,
            workspaces: [
                {
                    nametag: "caller",
                    userId: "caller-1",
                    firstName: "Caller",
                    lastName: null,
                    emoji: null,
                    isSelf: true
                },
                {
                    nametag: "joined-space",
                    userId: "workspace-joined",
                    firstName: "Joined",
                    lastName: null,
                    emoji: null,
                    isSelf: false
                },
                {
                    nametag: "owned-space",
                    userId: "workspace-owned",
                    firstName: "Owned",
                    lastName: null,
                    emoji: null,
                    isSelf: false
                }
            ]
        });
    });
});
