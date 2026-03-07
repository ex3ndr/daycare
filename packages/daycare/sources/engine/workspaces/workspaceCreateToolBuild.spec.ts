import { describe, expect, it, vi } from "vitest";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForAgent } from "../agents/context.js";
import { workspaceCreateToolBuild } from "./workspaceCreateToolBuild.js";

describe("workspaceCreateToolBuild", () => {
    it("builds shape and creates workspaces for owner users", async () => {
        const storage = await storageOpenTest();
        try {
            const owner = await storage.users.findOwner();
            if (!owner) {
                throw new Error("Owner user not found.");
            }

            const create = vi.fn(async () => ({
                userId: "workspace-1",
                nametag: "auto-generated",
                firstName: "Todo",
                lastName: null,
                memory: false
            }));
            const discover = vi.fn(async () => []);
            const refreshSandboxesForUserId = vi.fn(() => 1);
            const tool = workspaceCreateToolBuild({ create, discover });

            const result = await tool.execute(
                {
                    firstName: "Todo",
                    bio: "Manages todos",
                    systemPrompt: "You are todo",
                    memory: undefined
                },
                {
                    ctx: contextForAgent({ userId: owner.id, agentId: "agent-1" }),
                    agentSystem: {
                        storage,
                        refreshSandboxesForUserId
                    }
                } as never,
                { id: "call-1", name: "workspace_create" }
            );

            expect(tool.tool.name).toBe("workspace_create");
            expect(create).toHaveBeenCalledWith(
                owner.id,
                expect.objectContaining({ firstName: "Todo", memory: false })
            );
            expect(discover).toHaveBeenCalledWith(owner.id);
            expect(refreshSandboxesForUserId).toHaveBeenCalledWith(owner.id);
            expect(result.typedResult.nametag).toBe("auto-generated");
        } finally {
            storage.connection.close();
        }
    });

    it("rejects non-owner callers", async () => {
        const storage = await storageOpenTest();
        try {
            await storage.users.create({
                id: "user-1",
                nametag: "user-1",
                createdAt: 1,
                updatedAt: 1
            });
            const tool = workspaceCreateToolBuild({
                create: vi.fn(),
                discover: vi.fn(async () => [])
            });

            await expect(
                tool.execute(
                    {
                        firstName: "todo",
                        bio: "todo",
                        systemPrompt: "prompt"
                    },
                    {
                        ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                        agentSystem: {
                            storage,
                            refreshSandboxesForUserId: vi.fn(() => 0)
                        }
                    } as never,
                    { id: "call-1", name: "workspace_create" }
                )
            ).rejects.toThrow("Only the owner user can create workspaces.");
        } finally {
            storage.connection.close();
        }
    });
});
