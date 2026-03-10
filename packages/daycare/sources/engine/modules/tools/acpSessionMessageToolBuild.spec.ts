import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { contextForAgent } from "../../agents/context.js";
import { acpSessionMessageToolBuild } from "./acpSessionMessageToolBuild.js";

describe("acpSessionMessageToolBuild", () => {
    it("prompts a live ACP session and returns the answer", async () => {
        const prompt = vi.fn(async () => ({
            sessionId: "acp-1",
            stopReason: "end_turn" as const,
            answer: "done"
        }));
        const tool = acpSessionMessageToolBuild({ prompt } as never);
        const context = contextBuild();

        const result = await tool.execute({ id: "acp-1", prompt: "Status?" }, context, {
            id: "tool-1",
            name: "acp_session_message"
        });

        expect(prompt).toHaveBeenCalledWith("acp-1", "Status?", undefined);
        expect(result.typedResult).toEqual({
            answer: "done",
            sessionId: "acp-1",
            stopReason: "end_turn"
        });
    });
});

function contextBuild(): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: {
            id: "agent-1",
            path: "/user-1/agent/agent-1",
            config: {
                foreground: false,
                name: "owner",
                description: null,
                systemPrompt: null,
                workspaceDir: null
            }
        } as unknown as ToolExecutionContext["agent"],
        ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
        source: "test",
        messageContext: {},
        agentSystem: {} as ToolExecutionContext["agentSystem"]
    };
}
