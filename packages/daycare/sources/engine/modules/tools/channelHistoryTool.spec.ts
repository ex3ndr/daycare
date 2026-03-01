import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { channelHistoryToolBuild } from "./channelHistoryTool.js";

const toolCall = { id: "tool-1", name: "channel_history" };

describe("channelHistoryToolBuild", () => {
    it("returns channel history from facade", async () => {
        const getHistory = vi.fn(async () => [
            {
                id: "m1",
                channelName: "dev",
                senderUsername: "alice",
                text: "hello",
                mentions: [],
                createdAt: 1
            }
        ]);
        const tool = channelHistoryToolBuild({ getHistory } as never);
        const result = await tool.execute(
            {
                channelName: "dev",
                limit: 5
            },
            contextBuild(),
            toolCall
        );

        expect(getHistory).toHaveBeenCalledWith({ agentId: "agent-caller", userId: "user-1" }, "dev", 5);
        expect(result.toolMessage.isError).toBe(false);
        const text = contentText(result.toolMessage.content);
        expect(text).toContain("@alice: hello");
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
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"]
    };
}

function contentText(content: unknown): string {
    if (!Array.isArray(content)) {
        return "";
    }
    return content
        .filter((item) => typeof item === "object" && item !== null && (item as { type?: unknown }).type === "text")
        .map((item) => (item as { text?: unknown }).text)
        .filter((value): value is string => typeof value === "string")
        .join("\n");
}
