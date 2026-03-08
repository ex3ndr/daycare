import { describe, expect, it } from "vitest";
import { appWorkspaceResolve, WorkspaceAccessError } from "./appWorkspaceResolve.js";

describe("appWorkspaceResolve", () => {
    it("allows self workspace access", async () => {
        await expect(
            appWorkspaceResolve("/w/user-1/agents", "user-1", {
                findById: async () => null
            } as never)
        ).resolves.toEqual({
            workspaceUserId: "user-1",
            strippedPathname: "/agents"
        });
    });

    it("allows workspace owners and members", async () => {
        const users = {
            findById: async (id: string) =>
                id === "workspace-1"
                    ? {
                          id,
                          isWorkspace: true,
                          workspaceOwnerId: "owner-1"
                      }
                    : null
        };

        await expect(appWorkspaceResolve("/w/workspace-1/home", "owner-1", users as never)).resolves.toEqual({
            workspaceUserId: "workspace-1",
            strippedPathname: "/home"
        });

        await expect(
            appWorkspaceResolve(
                "/w/workspace-1/home",
                "member-1",
                users as never,
                {
                    isMember: async (workspaceId: string, userId: string) =>
                        workspaceId === "workspace-1" && userId === "member-1"
                } as never
            )
        ).resolves.toEqual({
            workspaceUserId: "workspace-1",
            strippedPathname: "/home"
        });
    });

    it("rejects non-members", async () => {
        await expect(
            appWorkspaceResolve(
                "/w/workspace-1/home",
                "intruder-1",
                {
                    findById: async () => ({
                        id: "workspace-1",
                        isWorkspace: true,
                        workspaceOwnerId: "owner-1"
                    })
                } as never,
                {
                    isMember: async () => false
                } as never
            )
        ).rejects.toThrow(WorkspaceAccessError);
    });
});
