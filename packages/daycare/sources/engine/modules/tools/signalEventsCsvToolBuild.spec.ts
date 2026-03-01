import { describe, expect, it } from "vitest";

import type { Signal, ToolExecutionContext } from "@/types";
import { signalEventsCsvToolBuild } from "./signalEventsCsvToolBuild.js";

const toolCall = { id: "tool-1", name: "signal_events_csv" };

describe("signalEventsCsvToolBuild", () => {
    it("renders filtered event rows as CSV", async () => {
        const tool = signalEventsCsvToolBuild({
            listRecentForContext: async () => signalEventsFixture()
        } as never);
        const result = await tool.execute(
            {
                fromAt: 2000,
                toAt: 3000,
                types: ["build.done"]
            },
            contextBuild(),
            toolCall
        );

        const text = contentText(result.toolMessage.content);
        expect(text).toContain("event_type,args,unix_time,ai_friendly_time");
        expect(text).toContain('"{""ok"":true}"');
        expect(text).toContain("build.done");
        expect(text).toContain("2000");
        expect(text).toContain("1970-01-01T00:00:02.000Z");
        expect(text).not.toContain("build.failed");
        expect(text).not.toContain("1000");
        expect(text).not.toContain("4000");
    });

    it("returns only CSV header when no records match", async () => {
        const tool = signalEventsCsvToolBuild({
            listRecentForContext: async () => signalEventsFixture()
        } as never);
        const result = await tool.execute(
            {
                types: ["missing.type"]
            },
            contextBuild(),
            toolCall
        );

        const text = contentText(result.toolMessage.content);
        expect(text).toBe("event_type,args,unix_time,ai_friendly_time");
    });

    it("rejects invalid time ranges", async () => {
        const tool = signalEventsCsvToolBuild({
            listRecentForContext: async () => signalEventsFixture()
        } as never);

        await expect(
            tool.execute(
                {
                    fromAt: 5,
                    toAt: 4
                },
                contextBuild(),
                toolCall
            )
        ).rejects.toThrow("fromAt must be less than or equal to toAt.");
    });
});

function signalEventsFixture(): Signal[] {
    return [
        {
            id: "e1",
            type: "build.done",
            source: { type: "system", userId: "user-1" },
            data: { ok: true },
            createdAt: 2000
        },
        {
            id: "e2",
            type: "build.failed",
            source: { type: "system", userId: "user-1" },
            data: { ok: false },
            createdAt: 3000
        },
        {
            id: "e3",
            type: "deploy.done",
            source: { type: "system", userId: "user-1" },
            data: { env: "prod" },
            createdAt: 4000
        }
    ];
}

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
