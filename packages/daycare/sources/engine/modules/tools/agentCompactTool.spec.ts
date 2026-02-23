import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { contextForAgent } from "../../agents/context.js";
import { agentCompactToolBuild } from "./agentCompactTool.js";

const toolCall = { id: "tool-1", name: "agent_compact" };

describe("agentCompactToolBuild", () => {
    it("posts compact for an existing agent", async () => {
        const agentExists = vi.fn(async () => true);
        const contextForAgentId = vi.fn(async () => contextForAgent({ userId: "user-1", agentId: "agent-target" }));
        const post = vi.fn(async () => undefined);
        const tool = agentCompactToolBuild();
        const context = contextBuild({ agentExists, contextForAgentId, post });

        const result = await tool.execute({ agentId: "agent-target" }, context, toolCall);

        expect(agentExists).toHaveBeenCalledWith("agent-target");
        expect(post).toHaveBeenCalledWith(context.ctx, { agentId: "agent-target" }, { type: "compact" });
        expect(result.typedResult.targetAgentId).toBe("agent-target");
    });

    it("throws when target agent does not exist", async () => {
        const agentExists = vi.fn(async () => false);
        const contextForAgentId = vi.fn(async () => null);
        const post = vi.fn(async () => undefined);
        const tool = agentCompactToolBuild();
        const context = contextBuild({ agentExists, contextForAgentId, post });

        await expect(tool.execute({ agentId: "missing-agent" }, context, toolCall)).rejects.toThrow(
            "Agent not found: missing-agent"
        );
        expect(post).not.toHaveBeenCalled();
    });

    it("throws when attempting to compact the current agent", async () => {
        const agentExists = vi.fn(async () => true);
        const contextForAgentId = vi.fn(async () => contextForAgent({ userId: "user-1", agentId: "agent-source" }));
        const post = vi.fn(async () => undefined);
        const tool = agentCompactToolBuild();
        const context = contextBuild({ agentExists, contextForAgentId, post });

        await expect(tool.execute({ agentId: "agent-source" }, context, toolCall)).rejects.toThrow(
            "Cannot compact the current agent."
        );
        expect(agentExists).not.toHaveBeenCalled();
        expect(post).not.toHaveBeenCalled();
    });
});

function contextBuild(agentSystem: {
    agentExists: (agentId: string) => Promise<boolean>;
    contextForAgentId: (agentId: string) => Promise<unknown>;
    post: (ctx: unknown, target: unknown, item: unknown) => Promise<void>;
}): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: { id: "agent-source" } as unknown as ToolExecutionContext["agent"],
        ctx: contextForAgent({ userId: "user-1", agentId: "agent-source" }),
        source: "test",
        messageContext: {},
        agentSystem: agentSystem as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}
