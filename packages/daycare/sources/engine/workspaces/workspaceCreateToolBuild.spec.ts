import { describe, expect, it, vi } from "vitest";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForAgent } from "../agents/context.js";
import { workspaceCreateToolBuild } from "./workspaceCreateToolBuild.js";

describe("workspaceCreateToolBuild", () => {
    it("builds shape and creates workspaces for personal users", async () => {
        const storage = await storageOpenTest();
        try {
            const owner = await storage.users.findById("sy45wijd1hmr03ef2wu7busv");
            if (!owner) {
                throw new Error("Owner user not found.");
            }

            const create = vi.fn(async () => ({
                userId: "workspace-1",
                nametag: "auto-generated",
                firstName: "Todo",
                lastName: null,
                memory: false,
                emoji: "✅"
            }));
            const discover = vi.fn(async () => []);
            const refreshSandboxesForUserId = vi.fn(() => 1);
            const tool = workspaceCreateToolBuild({ create, discover });

            const result = await tool.execute(
                {
                    firstName: "Todo",
                    bio: "Manages todos",
                    systemPrompt: "You are todo",
                    emoji: "✅",
                    memory: undefined
                },
                {
                    ctx: contextForAgent({ userId: owner.id, personUserId: owner.id, agentId: "agent-1" }),
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

    it("rejects workspace callers", async () => {
        const storage = await storageOpenTest();
        try {
            const owner = await storage.users.findById("sy45wijd1hmr03ef2wu7busv");
            if (!owner) {
                throw new Error("Owner user not found.");
            }
            await storage.users.create({
                id: "workspace-1",
                isWorkspace: true,
                workspaceOwnerId: owner.id,
                nametag: "workspace-1",
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
                        systemPrompt: "prompt",
                        emoji: "📝"
                    },
                    {
                        ctx: contextForAgent({ userId: "workspace-1", agentId: "agent-1" }),
                        agentSystem: {
                            storage,
                            refreshSandboxesForUserId: vi.fn(() => 0)
                        }
                    } as never,
                    { id: "call-1", name: "workspace_create" }
                )
            ).rejects.toThrow("Workspace creation requires personUserId.");
        } finally {
            storage.connection.close();
        }
    });

    it("rejects when personUserId points to a workspace user", async () => {
        const storage = await storageOpenTest();
        try {
            const owner = await storage.users.findById("sy45wijd1hmr03ef2wu7busv");
            if (!owner) {
                throw new Error("Owner user not found.");
            }
            await storage.users.create({
                id: "workspace-1",
                isWorkspace: true,
                workspaceOwnerId: owner.id,
                nametag: "workspace-1",
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
                        systemPrompt: "prompt",
                        emoji: "📝"
                    },
                    {
                        ctx: contextForAgent({ userId: owner.id, personUserId: "workspace-1", agentId: "agent-1" }),
                        agentSystem: {
                            storage,
                            refreshSandboxesForUserId: vi.fn(() => 0)
                        }
                    } as never,
                    { id: "call-1", name: "workspace_create" }
                )
            ).rejects.toThrow("Only personal users can create workspaces.");
        } finally {
            storage.connection.close();
        }
    });
});
