import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { EngineEventBus } from "../../ipc/events.js";
import { Signals } from "../../signals/signals.js";
import { buildSignalUnsubscribeTool } from "./signalUnsubscribeToolBuild.js";

const toolCall = { id: "tool-1", name: "signal_unsubscribe" };

describe("buildSignalUnsubscribeTool", () => {
    it("removes an existing subscription", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-signal-unsubscribe-tool-"));
        try {
            const signals = new Signals({ eventBus: new EngineEventBus(), configDir: dir });
            await signals.subscribe({
                ctx: { userId: "user-target", agentId: "agent-target" },
                pattern: "build:*:done",
                silent: true
            });
            const tool = buildSignalUnsubscribeTool(signals);
            const result = await tool.execute(
                { pattern: "build:*:done", agentId: "agent-target" },
                contextBuild("agent-source", true),
                toolCall
            );

            expect(result.toolMessage.isError).toBe(false);
            const details = result.toolMessage.details as
                | {
                      removed?: boolean;
                      agentId?: string;
                      pattern?: string;
                  }
                | undefined;
            expect(details?.removed).toBe(true);
            expect(details?.agentId).toBe("agent-target");
            expect(details?.pattern).toBe("build:*:done");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("throws when target agent does not exist", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-signal-unsubscribe-tool-"));
        try {
            const signals = new Signals({ eventBus: new EngineEventBus(), configDir: dir });
            const tool = buildSignalUnsubscribeTool(signals);

            await expect(
                tool.execute(
                    { pattern: "build:*:done", agentId: "missing-agent" },
                    contextBuild("agent-source", false),
                    toolCall
                )
            ).rejects.toThrow("Agent not found: missing-agent");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("returns removed=false when subscription does not exist", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-signal-unsubscribe-tool-"));
        try {
            const signals = new Signals({ eventBus: new EngineEventBus(), configDir: dir });
            const tool = buildSignalUnsubscribeTool(signals);
            const result = await tool.execute(
                { pattern: "build:*:done", agentId: "agent-target" },
                contextBuild("agent-source", true),
                toolCall
            );
            const details = result.toolMessage.details as { removed?: boolean } | undefined;
            expect(details?.removed).toBe(false);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});

function contextBuild(agentId: string, exists: boolean): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: { id: agentId } as unknown as ToolExecutionContext["agent"],
        ctx: {
            agentId,
            userId: "user-source"
        } as unknown as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: {
            contextForAgentId: async (targetAgentId: string) =>
                exists
                    ? ({
                          agentId: targetAgentId,
                          userId: "user-target"
                      } as unknown as ToolExecutionContext["ctx"])
                    : null
        } as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}
