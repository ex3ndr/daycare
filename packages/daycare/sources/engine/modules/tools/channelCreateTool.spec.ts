import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { channelCreateToolBuild } from "./channelCreateTool.js";

const toolCall = { id: "tool-1", name: "channel_create" };

describe("channelCreateToolBuild", () => {
    it("creates channels through the facade", async () => {
        const create = vi.fn(async () => ({
            id: "ch-1",
            name: "dev",
            leader: "agent-leader",
            members: [],
            createdAt: 1,
            updatedAt: 1
        }));
        const tool = channelCreateToolBuild({ create } as never);
        const result = await tool.execute({ name: "dev", leaderAgentId: "agent-leader" }, contextBuild(), toolCall);

        expect(create).toHaveBeenCalledWith({ agentId: "agent-caller", userId: "user-1" }, "dev", "agent-leader");
        expect(result.toolMessage.isError).toBe(false);
    });
});

function contextBuild(): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: { id: "agent-caller" } as unknown as ToolExecutionContext["agent"],
        ctx: { agentId: "agent-caller", userId: "user-1" } as unknown as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}
