import { promises as fs } from "node:fs";
import path from "node:path";
import type { ToolCall, ToolResultMessage } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext, ToolExecutionResult } from "@/types";
import { montyPreambleBuild } from "../engine/modules/monty/montyPreambleBuild.js";
import { rlmExecute } from "../engine/modules/rlm/rlmExecute.js";
import type { ToolResolverApi } from "../engine/modules/toolResolver.js";

const SYSTEM_TASKS_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), ".");

const documentTreeTool = {
    name: "vault_tree",
    description: "Read a vault tree.",
    parameters: Type.Object(
        {
            path: Type.String()
        },
        { additionalProperties: false }
    )
};
const documentReadTool = {
    name: "vault_read",
    description: "Read a vault entry.",
    parameters: Type.Object(
        {
            path: Type.String()
        },
        { additionalProperties: false }
    )
};
const nowToolDefinition = {
    name: "now",
    description: "Read current time.",
    parameters: Type.Object({}, { additionalProperties: false })
};

async function systemTaskRead(taskName: string): Promise<string> {
    return fs.readFile(path.join(SYSTEM_TASKS_ROOT, taskName, "task.py"), "utf8");
}

function systemTaskResolver(
    entriesByPath: Record<
        string,
        {
            summary: string;
            entries?: Array<{ vaultId: string; title: string; path: string; updatedAt: number }>;
            readSummary?: string;
        }
    >,
    currentTimeMs = 43200001
) {
    const execute = vi.fn(async (toolCall: ToolCall, _context: ToolExecutionContext): Promise<ToolExecutionResult> => {
        const pathValue =
            typeof toolCall.arguments === "object" && toolCall.arguments !== null && "path" in toolCall.arguments
                ? String((toolCall.arguments as { path: string }).path)
                : "";
        if (toolCall.name === "now") {
            const summary = `Current time: 1970-01-01 12:00:00 (UTC, UTC); unix=${currentTimeMs}.`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: summary }],
                isError: false,
                timestamp: Date.now()
            };
            return {
                toolMessage,
                typedResult: {
                    summary,
                    unixTimeMs: currentTimeMs,
                    unixTimeSeconds: Math.floor(currentTimeMs / 1000),
                    isoTimeUtc: "1970-01-01T12:00:00.001Z",
                    timezone: "UTC",
                    timezoneAbbr: "UTC",
                    timezoneSource: "default",
                    localDate: "1970-01-01",
                    localTime: "12:00:00",
                    localDateTime: "1970-01-01 12:00:00"
                }
            };
        }

        const entry = entriesByPath[pathValue] ?? { summary: "", entries: [] };
        const summary = toolCall.name === "vault_read" ? (entry.readSummary ?? entry.summary) : entry.summary;
        const toolMessage: ToolResultMessage = {
            role: "toolResult",
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            content: [{ type: "text", text: summary }],
            isError: false,
            timestamp: Date.now(),
            details: { action: "read", path: pathValue, bytes: summary.length }
        };
        const typedResult = {
            summary,
            action: "read",
            isError: false,
            content: summary,
            path: pathValue,
            bytes: summary.length,
            size: summary.length,
            found: true,
            entries: entry.entries ?? []
        };
        return {
            toolMessage,
            typedResult:
                entry.entries?.[0]?.vaultId !== undefined
                    ? { ...typedResult, rootVaultId: entry.entries[0].vaultId }
                    : typedResult
        };
    });
    const resolver: ToolResolverApi = {
        listTools: () => [documentTreeTool, documentReadTool, nowToolDefinition],
        listToolsForAgent: () => [documentTreeTool, documentReadTool, nowToolDefinition],
        execute,
        deferredHandlerFor: () => undefined
    };
    return { resolver, execute };
}

function systemTaskContext(): ToolExecutionContext {
    const postAndAwait = vi.fn(async (_ctx, _target, item) => {
        if (item.type === "system_message") {
            return { type: "system_message" as const, responseText: "ok" };
        }
        if (item.type === "compact") {
            return { type: "compact" as const, ok: true };
        }
        throw new Error(`Unexpected inbox item type: ${item.type}`);
    });
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: null as unknown as ToolExecutionContext["agent"],
        ctx: { userId: "test-user", agentId: "test-agent" } as ToolExecutionContext["ctx"],
        source: "task",
        messageContext: {},
        agentSystem: {
            config: { current: { agentsDir: "/tmp/daycare-system-task-test", path: ":memory:" } },
            storage: {},
            postAndAwait
        } as unknown as ToolExecutionContext["agentSystem"],
        taskExecution: { taskId: "system:memory-compactor", taskVersion: 1 }
    };
}

describe("system-tasks VM execution", () => {
    describe("memory-compactor", () => {
        it("skips when memory changed outside the compaction window", async () => {
            const code = await systemTaskRead("memory-compactor");
            const { resolver, execute } = systemTaskResolver(
                {
                "vault://memory": {
                    summary: "memory",
                    entries: [
                        {
                            vaultId: "memory",
                            title: "Memory",
                            path: "vault://memory",
                            updatedAt: 1
                        },
                        {
                            vaultId: "prefs",
                            title: "Prefs",
                            path: "vault://memory/prefs",
                            updatedAt: 2
                        }
                    ]
                },
                "vault://system/memory": {
                    summary: "system memory",
                    entries: [
                        {
                            vaultId: "system-memory",
                            title: "System Memory",
                            path: "vault://system/memory",
                            updatedAt: 2
                        }
                    ]
                },
                "vault://system/memory/agent": {
                    summary: "agent prompt",
                    readSummary: "# Memory Agent\n\nKeep memory tidy."
                },
                "vault://system/memory/compactor": {
                    summary: "compactor prompt",
                    readSummary: "# Memory Compactor\n\nReview recent changes."
                }
                },
                12 * 60 * 60 * 1000 + 10
            );

            const context = systemTaskContext();
            const result = await rlmExecute(
                code,
                montyPreambleBuild([documentTreeTool, documentReadTool, nowToolDefinition]),
                context,
                resolver,
                "system-memory-compactor-noop",
                undefined
            );

            expect(result.skipTurn).toBe(true);
            expect(result.output).toBe("Turn skipped");
            expect(execute).toHaveBeenCalledTimes(5);
            expect(context.agentSystem.postAndAwait).not.toHaveBeenCalled();
        });

        it("runs step and compaction when memory changed within the window", async () => {
            const code = await systemTaskRead("memory-compactor");
            const { resolver, execute } = systemTaskResolver(
                {
                "vault://memory": {
                    summary: "memory",
                    entries: [
                        {
                            vaultId: "memory",
                            title: "Memory",
                            path: "vault://memory",
                            updatedAt: 1
                        },
                        {
                            vaultId: "fresh-note",
                            title: "Fresh Note",
                            path: "vault://memory/fresh-note",
                            updatedAt: 43200000
                        }
                    ]
                },
                "vault://system/memory": {
                    summary: "system memory",
                    entries: [
                        {
                            vaultId: "system-memory",
                            title: "System Memory",
                            path: "vault://system/memory",
                            updatedAt: 1
                        }
                    ]
                },
                "vault://system/memory/agent": {
                    summary: "agent prompt",
                    readSummary: "# Memory Agent\n\nKeep memory tidy."
                },
                "vault://system/memory/compactor": {
                    summary: "compactor prompt",
                    readSummary: "# Memory Compactor\n\nReview recent changes."
                }
                },
                43200000 + 1
            );

            const context = systemTaskContext();
            const result = await rlmExecute(
                code,
                montyPreambleBuild([documentTreeTool, documentReadTool, nowToolDefinition]),
                context,
                resolver,
                "system-memory-compactor-run",
                undefined
            );

            expect(result.skipTurn).toBe(true);
            expect(result.output).toBe("Turn skipped");
            expect(execute).toHaveBeenCalledTimes(5);
            expect(context.agentSystem.postAndAwait).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({ agentId: "test-agent", userId: "test-user" }),
                { agentId: "test-agent" },
                expect.objectContaining({
                    type: "system_message",
                    text: expect.stringContaining("Run scheduled memory compaction now.")
                })
            );
            expect(context.agentSystem.postAndAwait).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({ agentId: "test-agent", userId: "test-user" }),
                { agentId: "test-agent" },
                { type: "compact" }
            );
        });
    });
});
