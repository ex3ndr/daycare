import { describe, expect, it } from "vitest";
import { storageOpenTest } from "./storageOpenTest.js";

describe("WorkspaceMembersRepository", () => {
    it("adds and lists active members", async () => {
        const storage = await storageOpenTest();
        try {
            await storage.workspaceMembers.add("workspace-1", "user-1");

            await expect(storage.workspaceMembers.isMember("workspace-1", "user-1")).resolves.toBe(true);
            await expect(storage.workspaceMembers.isKicked("workspace-1", "user-1")).resolves.toBe(false);
            await expect(storage.workspaceMembers.findByWorkspace("workspace-1")).resolves.toMatchObject([
                {
                    workspaceId: "workspace-1",
                    userId: "user-1"
                }
            ]);
            await expect(storage.workspaceMembers.findByUser("user-1")).resolves.toMatchObject([
                {
                    workspaceId: "workspace-1",
                    userId: "user-1"
                }
            ]);
        } finally {
            storage.connection.close();
        }
    });

    it("makes add idempotent for active members", async () => {
        const storage = await storageOpenTest();
        try {
            await storage.workspaceMembers.add("workspace-1", "user-1");
            await storage.workspaceMembers.add("workspace-1", "user-1");

            expect(await storage.workspaceMembers.findByWorkspace("workspace-1")).toHaveLength(1);
        } finally {
            storage.connection.close();
        }
    });

    it("kicks active members and blocks re-adding them", async () => {
        const storage = await storageOpenTest();
        try {
            await storage.workspaceMembers.add("workspace-1", "user-1");
            await storage.workspaceMembers.kick("workspace-1", "user-1", "removed");

            await expect(storage.workspaceMembers.isMember("workspace-1", "user-1")).resolves.toBe(false);
            await expect(storage.workspaceMembers.isKicked("workspace-1", "user-1")).resolves.toBe(true);
            await expect(storage.workspaceMembers.findByWorkspace("workspace-1")).resolves.toEqual([]);
            await expect(storage.workspaceMembers.add("workspace-1", "user-1")).rejects.toThrow(
                "You have been removed from this workspace."
            );
        } finally {
            storage.connection.close();
        }
    });

    it("ignores kicks for non-existent members", async () => {
        const storage = await storageOpenTest();
        try {
            await storage.workspaceMembers.kick("workspace-1", "user-404", "removed");

            await expect(storage.workspaceMembers.isMember("workspace-1", "user-404")).resolves.toBe(false);
            await expect(storage.workspaceMembers.isKicked("workspace-1", "user-404")).resolves.toBe(false);
        } finally {
            storage.connection.close();
        }
    });
});
