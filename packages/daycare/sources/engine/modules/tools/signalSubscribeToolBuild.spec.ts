import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { EngineEventBus } from "../../ipc/events.js";
import { Signals } from "../../signals/signals.js";
import { buildSignalSubscribeTool } from "./signalSubscribeToolBuild.js";

const toolCall = { id: "tool-1", name: "signal_subscribe" };

describe("buildSignalSubscribeTool", () => {
    it("subscribes target agent when it exists", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-signal-subscribe-tool-"));
        try {
            const signals = new Signals({ eventBus: new EngineEventBus(), configDir: dir });
            const tool = buildSignalSubscribeTool(signals);
            const result = await tool.execute(
                { pattern: "build:*:done", silent: false, agentId: "agent-target" },
                contextForAgent("agent-source", true),
                toolCall
            );

            expect(result.toolMessage.isError).toBe(false);
            const details = result.toolMessage.details as
                | {
                      subscription?: {
                          ctx: { userId: string; agentId: string };
                          pattern: string;
                          silent: boolean;
                          createdAt: number;
                          updatedAt: number;
                      };
                  }
                | undefined;
            expect(details?.subscription?.ctx.agentId).toBe("agent-target");
            expect(details?.subscription?.ctx.userId).toBe("user-target");
            expect(details?.subscription?.pattern).toBe("build:*:done");
            expect(details?.subscription?.silent).toBe(false);
            expect(details?.subscription?.createdAt).toBeTypeOf("number");
            expect(details?.subscription?.updatedAt).toBeTypeOf("number");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("throws when target agent does not exist", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-signal-subscribe-tool-"));
        try {
            const signals = new Signals({ eventBus: new EngineEventBus(), configDir: dir });
            const tool = buildSignalSubscribeTool(signals);

            await expect(
                tool.execute(
                    { pattern: "build:*:done", agentId: "missing-agent" },
                    contextForAgent("agent-source", false),
                    toolCall
                )
            ).rejects.toThrow("Agent not found: missing-agent");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});

function contextForAgent(agentId: string, exists: boolean): ToolExecutionContext {
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
