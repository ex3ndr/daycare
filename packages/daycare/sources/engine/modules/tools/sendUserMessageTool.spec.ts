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

    it("targets a swarm by nametag with plain system message", async () => {
        const post = vi.fn();
        const tool = sendUserMessageToolBuild();
        const ctx = contextBuild({
            agentId: "bg-4",
            descriptor: { type: "subagent", id: "bg-4", parentAgentId: "fg-1", name: "worker" },
            post,
            usersFindByNametag: vi.fn(async () => ({
                id: "swarm-user-1",
                isSwarm: true
            })),
            usersFindById: vi.fn(async () => ({
                id: "swarm-user-1",
                isSwarm: true
            })),
            agentsFindById: vi.fn(async () => ({
                id: "bg-4"
            })),
            agentIdForTarget: vi.fn(async () => "swarm-agent-1"),
            recordReceived: vi.fn(async () => undefined)
        });

        await tool.execute({ text: "hello swarm", nametag: "todo" }, ctx, toolCall);

        expect(post).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "swarm-user-1", hasAgentId: false }),
            { agentId: "swarm-agent-1" },
            {
                type: "system_message",
                text: "hello swarm",
                origin: "bg-4"
            }
        );
    });

    it("throws when target nametag is not a swarm", async () => {
        const tool = sendUserMessageToolBuild();
        const ctx = contextBuild({
            agentId: "bg-5",
            descriptor: { type: "permanent", id: "bg-5", name: "bot" },
            post: vi.fn(),
            usersFindByNametag: vi.fn(async () => ({ id: "user-2", isSwarm: false }))
        });

        await expect(tool.execute({ text: "hello", nametag: "user-2" }, ctx, toolCall)).rejects.toThrow(
            "Target is not a swarm"
        );
    });
});

function contextBuild(opts: {
    agentId: string;
    descriptor: Record<string, unknown>;
    post: ReturnType<typeof vi.fn>;
    foregroundAgentId?: string | null;
    usersFindByNametag?: (nametag: string) => Promise<unknown>;
    usersFindById?: (id: string) => Promise<unknown>;
    agentsFindById?: (id: string) => Promise<unknown>;
    agentIdForTarget?: (ctx: unknown, target: unknown) => Promise<string>;
    recordReceived?: (swarmUserId: string, contactAgentId: string) => Promise<void>;
    postAndAwait?: (ctx: unknown, target: unknown, item: unknown) => Promise<unknown>;
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
            postAndAwait: opts.postAndAwait ?? (vi.fn(async () => ({ type: "message", responseText: null })) as never),
            agentFor: (_ctx: unknown) => opts.foregroundAgentId ?? undefined,
            agentIdForTarget: opts.agentIdForTarget ?? (vi.fn(async () => "swarm-agent-1") as never),
            storage: {
                users: {
                    findByNametag: opts.usersFindByNametag ?? (vi.fn(async () => null) as never),
                    findById: opts.usersFindById ?? (vi.fn(async () => null) as never)
                },
                agents: {
                    findById: opts.agentsFindById ?? (vi.fn(async () => null) as never)
                },
                swarmContacts: {
                    findOrCreate: vi.fn(async () => undefined),
                    recordReceived: opts.recordReceived ?? (vi.fn(async () => undefined) as never)
                }
            }
        } as unknown as ToolExecutionContext["agentSystem"]
    };
}
