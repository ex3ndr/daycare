import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { contextForAgent } from "../../agents/context.js";
import { sendUserMessageToolBuild } from "./sendUserMessageTool.js";

const toolCall = { id: "tool-1", name: "send_user_message" };

describe("sendUserMessageToolBuild", () => {
    it("posts message_for_user to parent agent for subagents", async () => {
        const post = vi.fn();
        const tool = sendUserMessageToolBuild();
        const ctx = contextBuild({
            agentId: "bg-1",
            descriptor: { type: "subagent", id: "bg-1", parentAgentId: "fg-1", name: "worker" },
            post
        });

        const result = await tool.execute({ text: "task done" }, ctx, toolCall);

        expect(post).toHaveBeenCalledWith(
            ctx.ctx,
            { agentId: "fg-1" },
            {
                type: "system_message",
                text: '<message_for_user origin="bg-1">task done</message_for_user>',
                origin: "bg-1"
            }
        );
        expect(result.toolMessage.isError).toBe(false);
    });

    it("falls back to most-recent-foreground when no parent", async () => {
        const post = vi.fn();
        const tool = sendUserMessageToolBuild();
        const ctx = contextBuild({
            agentId: "bg-2",
            descriptor: { type: "permanent", id: "bg-2", name: "bot" },
            post,
            foregroundAgentId: "fg-main"
        });

        await tool.execute({ text: "hello user" }, ctx, toolCall);

        expect(post).toHaveBeenCalledWith(
            ctx.ctx,
            { agentId: "fg-main" },
            expect.objectContaining({ type: "system_message" })
        );
    });

    it("throws when no foreground agent is found", async () => {
        const tool = sendUserMessageToolBuild();
        const ctx = contextBuild({
            agentId: "bg-3",
            descriptor: { type: "permanent", id: "bg-3", name: "bot" },
            post: vi.fn(),
            foregroundAgentId: null
        });

        await expect(tool.execute({ text: "hi" }, ctx, toolCall)).rejects.toThrow("No foreground agent found");
    });
});

function contextBuild(opts: {
    agentId: string;
    descriptor: Record<string, unknown>;
    post: ReturnType<typeof vi.fn>;
    foregroundAgentId?: string | null;
}): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: {
            id: opts.agentId,
            descriptor: opts.descriptor
        } as unknown as ToolExecutionContext["agent"],
        ctx: contextForAgent({ userId: "user-1", agentId: opts.agentId }),
        source: "test",
        messageContext: {},
        agentSystem: {
            post: opts.post,
            agentFor: (_ctx: unknown) => opts.foregroundAgentId ?? undefined
        } as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}
