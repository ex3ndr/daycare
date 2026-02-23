import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { contextForAgent } from "../../agents/context.js";
import { buildStartBackgroundAgentTool } from "./background.js";

const toolCall = { id: "tool-1", name: "start_background_agent" };

describe("buildStartBackgroundAgentTool", () => {
    it("creates subagent target and posts the first message", async () => {
        const calls: string[] = [];
        const resolveTarget = vi.fn(async () => {
            calls.push("resolve");
            return "agent-123";
        });
        const post = vi.fn(async () => {
            calls.push("post");
        });

        const tool = buildStartBackgroundAgentTool();
        const context = contextBuild({
            agentIdForTarget: resolveTarget,
            post
        });

        const result = await tool.execute({ prompt: "Do work" }, context, toolCall);

        expect(calls).toEqual(["resolve", "post"]);
        expect(post).toHaveBeenCalledWith(
            context.ctx,
            { agentId: "agent-123" },
            { type: "message", message: { text: "Do work" }, context: {} }
        );
        expect(contentText(result.toolMessage.content)).toContain("agent-123");
    });
});

function contextBuild(agentSystem: {
    agentIdForTarget: (ctx: unknown, target: unknown) => Promise<string>;
    post: (ctx: unknown, target: unknown, item: unknown) => Promise<void>;
}): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: { id: "parent-agent" } as unknown as ToolExecutionContext["agent"],
        ctx: contextForAgent({ userId: "user-1", agentId: "parent-agent" }),
        source: "test",
        messageContext: {},
        agentSystem: agentSystem as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}

function contentText(content: unknown): string {
    if (!Array.isArray(content)) {
        return "";
    }
    return content
        .filter((item) => {
            if (typeof item !== "object" || item === null) {
                return false;
            }
            return (item as { type?: unknown }).type === "text";
        })
        .map((item) => (item as { text?: unknown }).text)
        .filter((value): value is string => typeof value === "string")
        .join("\n");
}
