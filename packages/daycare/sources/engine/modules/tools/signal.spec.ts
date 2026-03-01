import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { EngineEventBus } from "../../ipc/events.js";
import { Signals } from "../../signals/signals.js";
import { buildSignalGenerateTool } from "./signal.js";

const toolCall = { id: "tool-1", name: "generate_signal" };

describe("buildSignalGenerateTool", () => {
    it("generates agent source signals by default", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-signal-tool-"));
        try {
            const eventBus = new EngineEventBus();
            const storage = await storageOpenTest();
            const signals = new Signals({
                eventBus,
                observationLog: storage.observationLog,
                signalEvents: storage.signalEvents,
                signalSubscriptions: storage.signalSubscriptions
            });
            const events: Array<{ type: string; payload: unknown }> = [];

            const unsubscribe = eventBus.onEvent((event) => {
                events.push({ type: event.type, payload: event.payload });
            });

            await signals.ensureDir();
            const tool = buildSignalGenerateTool(signals);
            const result = await tool.execute(
                {
                    type: "automation.requested",
                    data: { target: "deploy" }
                },
                contextForAgent("agent-123"),
                toolCall
            );

            unsubscribe();

            expect(result.toolMessage.isError).toBe(false);
            const details = result.toolMessage.details as
                | {
                      signal?: {
                          type: string;
                          source: { type: string; id?: string; userId?: string };
                          data?: unknown;
                      };
                  }
                | undefined;
            expect(details?.signal?.type).toBe("automation.requested");
            expect(details?.signal?.source).toEqual({
                type: "agent",
                id: "agent-123",
                userId: "user-123"
            });
            expect(details?.signal?.data).toEqual({ target: "deploy" });
            expect(events.some((event) => event.type === "signal.generated")).toBe(true);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});

function contextForAgent(agentId: string): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: { id: agentId } as unknown as ToolExecutionContext["agent"],
        ctx: {
            agentId,
            userId: "user-123"
        } as unknown as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"]
    };
}
