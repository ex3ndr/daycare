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
    name: "document_tree",
    description: "Read a document tree.",
    parameters: Type.Object(
        {
            path: Type.String()
        },
        { additionalProperties: false }
    )
};
const documentReadTool = {
    name: "document_read",
    description: "Read a document.",
    parameters: Type.Object(
        {
            path: Type.String()
        },
        { additionalProperties: false }
    )
};

async function systemTaskRead(taskName: string): Promise<string> {
    return fs.readFile(path.join(SYSTEM_TASKS_ROOT, taskName, "task.py"), "utf8");
}

function systemTaskResolver(
    documentsByPath: Record<
        string,
        {
            summary: string;
            documents?: Array<{ documentId: string; title: string; path: string; updatedAt: number }>;
            readSummary?: string;
        }
    >
) {
    const execute = vi.fn(async (toolCall: ToolCall, _context: ToolExecutionContext): Promise<ToolExecutionResult> => {
        const pathValue =
            typeof toolCall.arguments === "object" && toolCall.arguments !== null && "path" in toolCall.arguments
                ? String((toolCall.arguments as { path: string }).path)
                : "";
        const entry = documentsByPath[pathValue] ?? { summary: "", documents: [] };
        const summary = toolCall.name === "document_read" ? (entry.readSummary ?? entry.summary) : entry.summary;
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
            documents: entry.documents ?? []
        };
        return {
            toolMessage,
            typedResult:
                entry.documents?.[0]?.documentId !== undefined
                    ? { ...typedResult, rootDocumentId: entry.documents[0].documentId }
                    : typedResult
        };
    });
    const resolver: ToolResolverApi = {
        listTools: () => [documentTreeTool, documentReadTool],
        listToolsForAgent: () => [documentTreeTool, documentReadTool],
        execute,
        deferredHandlerFor: () => undefined
    };
    return { resolver, execute };
}

function systemTaskContext(): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: null as unknown as ToolExecutionContext["agent"],
        ctx: { userId: "test-user", agentId: "test-agent" } as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: {
            config: { current: { agentsDir: "/tmp/daycare-system-task-test", path: ":memory:" } },
            storage: {}
        } as unknown as ToolExecutionContext["agentSystem"]
    };
}

describe("system-tasks VM execution", () => {
    describe("memory-cleanup", () => {
        it("returns a no-op message when memory changed outside the cleanup window", async () => {
            const code = await systemTaskRead("memory-cleanup");
            const { resolver, execute } = systemTaskResolver({
                "doc://memory": {
                    summary: "memory",
                    documents: [
                        {
                            documentId: "memory",
                            title: "Memory",
                            path: "doc://memory",
                            updatedAt: 1
                        },
                        {
                            documentId: "prefs",
                            title: "Prefs",
                            path: "doc://memory/prefs",
                            updatedAt: 2
                        }
                    ]
                },
                "doc://system/memory": {
                    summary: "system memory",
                    documents: [
                        {
                            documentId: "system-memory",
                            title: "System Memory",
                            path: "doc://system/memory",
                            updatedAt: 2
                        }
                    ]
                },
                "doc://system/memory/agent": {
                    summary: "agent prompt",
                    readSummary: "# Memory Agent\n\nKeep memory tidy."
                },
                "doc://system/memory/cleanup": {
                    summary: "cleanup prompt",
                    readSummary: "# Memory Cleanup\n\nReview recent changes."
                }
            });

            const result = await rlmExecute(
                code,
                montyPreambleBuild([documentTreeTool, documentReadTool]),
                systemTaskContext(),
                resolver,
                "system-memory-cleanup-noop",
                undefined,
                undefined,
                { current_time_ms: 12 * 60 * 60 * 1000 + 10 },
                [{ name: "current_time_ms", type: "integer", nullable: false }]
            );

            expect(result.output).toBe("No recent memory changes to organize.");
            expect(execute).toHaveBeenCalledTimes(4);
        });

        it("returns cleanup instructions when memory changed within the window", async () => {
            const code = await systemTaskRead("memory-cleanup");
            const { resolver, execute } = systemTaskResolver({
                "doc://memory": {
                    summary: "memory",
                    documents: [
                        {
                            documentId: "memory",
                            title: "Memory",
                            path: "doc://memory",
                            updatedAt: 1
                        },
                        {
                            documentId: "fresh-note",
                            title: "Fresh Note",
                            path: "doc://memory/fresh-note",
                            updatedAt: 43200000
                        }
                    ]
                },
                "doc://system/memory": {
                    summary: "system memory",
                    documents: [
                        {
                            documentId: "system-memory",
                            title: "System Memory",
                            path: "doc://system/memory",
                            updatedAt: 1
                        }
                    ]
                },
                "doc://system/memory/agent": {
                    summary: "agent prompt",
                    readSummary: "# Memory Agent\n\nKeep memory tidy."
                },
                "doc://system/memory/cleanup": {
                    summary: "cleanup prompt",
                    readSummary: "# Memory Cleanup\n\nReview recent changes."
                }
            });

            const result = await rlmExecute(
                code,
                montyPreambleBuild([documentTreeTool, documentReadTool]),
                systemTaskContext(),
                resolver,
                "system-memory-cleanup-run",
                undefined,
                undefined,
                { current_time_ms: 43200000 + 1 },
                [{ name: "current_time_ms", type: "integer", nullable: false }]
            );

            expect(result.output).toContain("Run scheduled memory maintenance now.");
            expect(result.output).toContain("Current memory-agent prompt document:");
            expect(result.output).toContain("# Memory Agent");
            expect(result.output).toContain("Current cleanup prompt document:");
            expect(result.output).toContain("# Memory Cleanup");
            expect(result.output).toContain("Current time: 43200001");
            expect(execute).toHaveBeenCalledTimes(4);
        });
    });
});
