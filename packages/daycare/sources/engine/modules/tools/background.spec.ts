import { describe, expect, it, vi } from "vitest";

import type { SessionPermissions, ToolExecutionContext } from "@/types";
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
        const context = contextBuild(buildPermissions({}), {
            agentIdForTarget: resolveTarget,
            post
        });

        const result = await tool.execute({ prompt: "Do work" }, context, toolCall);

        expect(calls).toEqual(["resolve", "post"]);
        expect(post).toHaveBeenCalledWith(
            { agentId: "agent-123" },
            { type: "message", message: { text: "Do work" }, context: {} }
        );
        expect(contentText(result.toolMessage.content)).toContain("agent-123");
    });
});

function buildPermissions(overrides: Partial<SessionPermissions>): SessionPermissions {
    return {
        workingDir: "/workspace",
        writeDirs: ["/workspace"],
        ...overrides
    };
}

function contextBuild(
    permissions: SessionPermissions,
    agentSystem: {
        agentIdForTarget: (target: unknown) => Promise<string>;
        post: (target: unknown, item: unknown) => Promise<void>;
    }
): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        fileStore: null as unknown as ToolExecutionContext["fileStore"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        permissions,
        agent: { id: "parent-agent" } as unknown as ToolExecutionContext["agent"],
        ctx: null as unknown as ToolExecutionContext["ctx"],
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
