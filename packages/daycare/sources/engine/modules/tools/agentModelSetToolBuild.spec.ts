import { describe, expect, it } from "vitest";
import { contextForAgent } from "../../agents/context.js";
import type { InferenceRouter } from "../inference/router.js";
import { agentModelSetToolBuild } from "./agentModelSetToolBuild.js";

// Minimal mock router — tests only check tool structure and visibility
const mockRouter = {} as InferenceRouter;

describe("agentModelSetToolBuild", () => {
    const tool = agentModelSetToolBuild(mockRouter);

    it("has the correct tool name", () => {
        expect(tool.tool.name).toBe("set_agent_model");
    });

    it("is visible only to user (foreground) agents", () => {
        expect(
            tool.visibleByDefault?.({
                ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                descriptor: { type: "user", connector: "telegram", userId: "user-1", channelId: "channel-1" }
            })
        ).toBe(true);
    });

    it("is not visible to subagent descriptors", () => {
        expect(
            tool.visibleByDefault?.({
                ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                descriptor: { type: "subagent", id: "sub-1", parentAgentId: "parent-1", name: "sub" }
            })
        ).toBe(false);
    });

    it("is not visible to permanent agent descriptors", () => {
        expect(
            tool.visibleByDefault?.({
                ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                descriptor: {
                    type: "permanent",
                    id: "perm-1",
                    name: "bot",
                    description: "test",
                    systemPrompt: "you are a bot"
                }
            })
        ).toBe(false);
    });

    it("is not visible to cron descriptors", () => {
        expect(
            tool.visibleByDefault?.({
                ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                descriptor: { type: "cron", id: "cron-1" }
            })
        ).toBe(false);
    });

    it("updates model override for agents in caller user scope", async () => {
        const result = await tool.execute(
            { agentId: "agent-2", model: "small" },
            {
                ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                agentSystem: {
                    contextForAgentId: async () => contextForAgent({ userId: "user-1", agentId: "agent-2" }),
                    updateAgentModelOverride: async () => true
                },
                agent: { descriptor: { type: "user" } },
                messageContext: {}
            } as never,
            { id: "tool-1", name: "set_agent_model" }
        );

        expect(result.toolMessage.isError).toBe(false);
    });

    it("rejects model override across users", async () => {
        await expect(
            tool.execute(
                { agentId: "agent-2", model: "small" },
                {
                    ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                    agentSystem: {
                        contextForAgentId: async () => contextForAgent({ userId: "user-2", agentId: "agent-2" }),
                        updateAgentModelOverride: async () => true
                    },
                    agent: { descriptor: { type: "user" } },
                    messageContext: {}
                } as never,
                { id: "tool-2", name: "set_agent_model" }
            )
        ).rejects.toThrow("Cannot change model for agent from another user: agent-2");
    });
});
