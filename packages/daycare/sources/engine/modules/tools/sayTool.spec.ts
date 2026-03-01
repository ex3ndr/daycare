import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { contextForAgent } from "../../agents/context.js";
import { sayTool } from "./sayTool.js";

const toolCall = { id: "tool-1", name: "say" };

describe("sayTool", () => {
    it("sends text to the current foreground target", async () => {
        const sendMessage = vi.fn(async () => undefined);
        const tool = sayTool();
        const context = contextBuild({ sendMessage });

        const result = await tool.execute({ text: "Hello user" }, context, toolCall);

        expect(sendMessage).toHaveBeenCalledWith("channel-1", {
            text: "Hello user",
            replyToMessageId: "message-1"
        });
        expect(result.toolMessage.isError).toBe(false);
    });

    it("defers sending during pythonExecution", async () => {
        const sendMessage = vi.fn(async () => undefined);
        const tool = sayTool();
        const context = contextBuild({ sendMessage });
        (context as Record<string, unknown>).pythonExecution = true;

        const result = await tool.execute({ text: "Hello user" }, context, toolCall);

        expect(sendMessage).not.toHaveBeenCalled();
        expect(result.deferredPayload).toEqual({
            connector: "telegram",
            targetId: "channel-1",
            text: "Hello user",
            replyToMessageId: "message-1"
        });
        expect(result.toolMessage.isError).toBe(false);
    });

    it("sends immediately during pythonExecution when now=true", async () => {
        const sendMessage = vi.fn(async () => undefined);
        const tool = sayTool();
        const context = contextBuild({ sendMessage });
        (context as Record<string, unknown>).pythonExecution = true;

        const result = await tool.execute({ text: "Urgent", now: true }, context, toolCall);

        expect(sendMessage).toHaveBeenCalledWith("channel-1", {
            text: "Urgent",
            replyToMessageId: "message-1"
        });
        expect(result.deferredPayload).toBeUndefined();
    });

    it("executeDeferred sends via connector", async () => {
        const sendMessage = vi.fn(async () => undefined);
        const tool = sayTool();
        const context = contextBuild({ sendMessage });

        await tool.executeDeferred!(
            { connector: "telegram", targetId: "channel-1", text: "deferred msg", replyToMessageId: "msg-1" },
            context
        );

        expect(sendMessage).toHaveBeenCalledWith("channel-1", {
            text: "deferred msg",
            replyToMessageId: "msg-1"
        });
    });

    it("is visible by default only for foreground user agents", () => {
        const tool = sayTool();
        const isUserVisible = tool.visibleByDefault?.({
            ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
            descriptor: { type: "user", connector: "telegram", channelId: "channel-1", userId: "user-1" }
        });
        const isSubagentVisible = tool.visibleByDefault?.({
            ctx: contextForAgent({ userId: "user-1", agentId: "agent-2" }),
            descriptor: { type: "subagent", id: "sub-1", parentAgentId: "agent-1", name: "subagent" }
        });

        expect(isUserVisible).toBe(true);
        expect(isSubagentVisible).toBe(false);
    });
});

function contextBuild(options: {
    sendMessage: (targetId: string, message: { text: string; replyToMessageId?: string }) => Promise<void>;
}): ToolExecutionContext {
    return {
        connectorRegistry: {
            get: () => ({
                capabilities: { sendText: true },
                onMessage: () => () => undefined,
                sendMessage: options.sendMessage
            })
        } as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: {
            id: "agent-1",
            descriptor: {
                type: "user",
                connector: "telegram",
                channelId: "channel-1",
                userId: "user-1"
            }
        } as unknown as ToolExecutionContext["agent"],
        ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
        source: "telegram",
        messageContext: { messageId: "message-1" },
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"]
    };
}
