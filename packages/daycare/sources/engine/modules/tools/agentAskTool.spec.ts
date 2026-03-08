import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { contextForAgent } from "../../agents/context.js";
import { agentAskTool } from "./agentAskTool.js";

const toolCall = { id: "tool-1", name: "agent_ask" };

describe("agentAskTool", () => {
    it("posts a system message and returns the awaited answer", async () => {
        const postAndAwait = vi.fn(async () => ({
            type: "system_message",
            responseText: "done"
        }));
        const tool = agentAskTool();
        const ctx = contextBuild({ postAndAwait });

        const result = await tool.execute({ id: "agent-2", prompt: "Status?" }, ctx, toolCall);

        expect(postAndAwait).toHaveBeenCalledWith(
            ctx.ctx,
            { agentId: "agent-2" },
            {
                type: "system_message",
                text: "Status?",
                origin: "agent-1"
            }
        );
        expect(result.typedResult).toEqual({ answer: "done", agentId: "agent-2" });
    });

    it("rejects self-targeting asks to avoid deadlock", async () => {
        const tool = agentAskTool();
        const ctx = contextBuild({
            postAndAwait: vi.fn(async () => ({
                type: "system_message",
                responseText: "unused"
            }))
        });

        await expect(tool.execute({ id: "agent-1", prompt: "loop" }, ctx, toolCall)).rejects.toThrow(
            "agent_ask cannot target the current agent"
        );
    });

    it("surfaces target execution errors", async () => {
        const tool = agentAskTool();
        const ctx = contextBuild({
            postAndAwait: vi.fn(async () => ({
                type: "system_message",
                responseText: null,
                responseError: true,
                executionErrorText: "Target failed."
            }))
        });

        await expect(tool.execute({ id: "agent-2", prompt: "Run it" }, ctx, toolCall)).rejects.toThrow(
            "Target failed."
        );
    });

    it("falls back when the target completes without text", async () => {
        const tool = agentAskTool();
        const ctx = contextBuild({
            postAndAwait: vi.fn(async () => ({
                type: "system_message",
                responseText: null
            }))
        });

        const result = await tool.execute({ id: "agent-2", prompt: "Ping" }, ctx, toolCall);

        expect(result.typedResult.answer).toBe("Agent completed without a text response.");
    });
});

function contextBuild(opts: {
    postAndAwait: (ctx: unknown, target: unknown, item: unknown) => Promise<unknown>;
}): ToolExecutionContext {
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
                name: "worker",
                description: null,
                systemPrompt: null,
                workspaceDir: null
            }
        } as unknown as ToolExecutionContext["agent"],
        ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
        source: "test",
        messageContext: {},
        agentSystem: {
            postAndAwait: opts.postAndAwait
        } as unknown as ToolExecutionContext["agentSystem"]
    };
}
