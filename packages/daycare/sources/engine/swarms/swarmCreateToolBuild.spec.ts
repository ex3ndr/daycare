import { describe, expect, it, vi } from "vitest";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForAgent } from "../agents/context.js";
import { swarmCreateToolBuild } from "./swarmCreateToolBuild.js";

describe("swarmCreateToolBuild", () => {
    it("builds shape and creates swarms for owner users", async () => {
        const storage = await storageOpenTest();
        try {
            const owner = await storage.users.findOwner();
            if (!owner) {
                throw new Error("Owner user not found.");
            }

            const create = vi.fn(async () => ({
                userId: "swarm-1",
                nametag: "todo",
                firstName: "Todo",
                lastName: null,
                memory: false
            }));
            const discover = vi.fn(async () => []);
            const refreshSandboxesForUserId = vi.fn(() => 1);
            const tool = swarmCreateToolBuild({ create, discover });

            const result = await tool.execute(
                {
                    nametag: "Todo",
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
                { id: "call-1", name: "swarm_create" }
            );

            expect(tool.tool.name).toBe("swarm_create");
            expect(create).toHaveBeenCalledWith(owner.id, expect.objectContaining({ nametag: "todo", memory: false }));
            expect(discover).toHaveBeenCalledWith(owner.id);
            expect(refreshSandboxesForUserId).toHaveBeenCalledWith(owner.id);
            expect(result.typedResult.nametag).toBe("todo");

            await expect(
                tool.execute(
                    {
                        nametag: "Bad Name",
                        firstName: "x",
                        bio: "x",
                        systemPrompt: "x"
                    },
                    {
                        ctx: contextForAgent({ userId: owner.id, agentId: "agent-1" }),
                        agentSystem: {
                            storage,
                            refreshSandboxesForUserId
                        }
                    } as never,
                    { id: "call-2", name: "swarm_create" }
                )
            ).rejects.toThrow("Swarm name must be username-style");
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
            const tool = swarmCreateToolBuild({
                create: vi.fn(),
                discover: vi.fn(async () => [])
            });

            await expect(
                tool.execute(
                    {
                        nametag: "todo",
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
                    { id: "call-1", name: "swarm_create" }
                )
            ).rejects.toThrow("Only the owner user can create swarms.");
        } finally {
            storage.connection.close();
        }
    });
});
