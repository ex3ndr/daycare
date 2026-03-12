import { promises as fs } from "node:fs";
import path from "node:path";
import type { ToolCall, ToolResultMessage } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext, ToolExecutionResult } from "@/types";
import { montyPreambleBuild } from "../engine/modules/monty/montyPreambleBuild.js";
import { rlmExecute } from "../engine/modules/rlm/rlmExecute.js";
import type { ToolResolverApi } from "../engine/modules/toolResolver.js";

const CORE_TASKS_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), ".");

const SAMPLE_PLAN = `# Fix Widget Rendering

## Overview

Fix the widget rendering bug.

## Context

Test context.

## Development Approach

Direct fix.

## Testing Strategy

Run tests.

## Validation Commands

- \`yarn test\`

## Progress Tracking

- [ ] Task 1

## What Goes Where

| Change | File |
|--------|------|
| Fix | src/widget.ts |

## Implementation Steps

### Task 1: Fix rendering bug

Fix the widget rendering.

Files:
- \`src/widget.ts\`

Verify:
- \`yarn test src/widget.spec.ts\`

- [ ] fix the rendering logic

## Post-Completion

- Merge PR
`;

const INCOMPLETE_PLAN = `# Bad Plan

## Overview

Missing most sections.
`;

const readTool = {
    name: "read",
    description: "Read file contents.",
    parameters: Type.Object({
        path: Type.String(),
        offset: Type.Optional(Type.Number()),
        limit: Type.Optional(Type.Number())
    }, { additionalProperties: false })
};

function createResolver(readContent: string) {
    const tools = [readTool];
    const execute = vi.fn(async (toolCall: ToolCall, _context: ToolExecutionContext): Promise<ToolExecutionResult> => {
        if (toolCall.name === "read") {
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: "read",
                content: [{ type: "text", text: readContent }],
                isError: false,
                timestamp: Date.now(),
                details: { action: "read", path: "/test/plan.md", bytes: readContent.length }
            };
            return {
                toolMessage,
                typedResult: {
                    summary: readContent,
                    action: "read",
                    isError: false,
                    content: readContent,
                    path: "/test/plan.md",
                    bytes: readContent.length,
                    size: readContent.length
                }
            };
        }
        throw new Error(`Unexpected tool: ${toolCall.name}`);
    });
    const resolver: ToolResolverApi = {
        listTools: () => tools,
        listToolsForAgent: () => tools,
        execute,
        deferredHandlerFor: () => undefined
    };
    return { resolver, execute };
}

function createContext(): ToolExecutionContext {
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
            config: { current: { agentsDir: "/tmp/daycare-core-task-test", path: ":memory:" } },
            storage: {}
        } as unknown as ToolExecutionContext["agentSystem"]
    };
}

async function loadTaskCode(taskName: string): Promise<string> {
    return fs.readFile(path.join(CORE_TASKS_ROOT, taskName, "task.py"), "utf8");
}

describe("core-tasks VM execution", () => {
    describe("plan-verify", () => {
        it("executes without error and calls read() with content accessor", async () => {
            const code = await loadTaskCode("plan-verify");
            const { resolver, execute } = createResolver(SAMPLE_PLAN);
            const preamble = montyPreambleBuild([readTool]);

            const result = await rlmExecute(
                code, preamble, createContext(), resolver, "plan-verify-test",
                undefined, undefined,
                { plan_path: "/test/plan.md" },
                [{ name: "plan_path", type: "string", nullable: false }]
            );

            expect(execute).toHaveBeenCalledTimes(1);
            expect(result.skipTurn).toBeFalsy();
        });

        it("fails gracefully on incomplete plan", async () => {
            const code = await loadTaskCode("plan-verify");
            const { resolver, execute } = createResolver(INCOMPLETE_PLAN);
            const preamble = montyPreambleBuild([readTool]);

            const result = await rlmExecute(
                code, preamble, createContext(), resolver, "plan-verify-incomplete",
                undefined, undefined,
                { plan_path: "/test/plan.md" },
                [{ name: "plan_path", type: "string", nullable: false }]
            );

            expect(execute).toHaveBeenCalledTimes(1);
            expect(result.skipTurn).toBeFalsy();
        });
    });

    describe("ralph-loop", () => {
        it("executes without error", async () => {
            const code = await loadTaskCode("ralph-loop");
            const { resolver, execute } = createResolver(SAMPLE_PLAN);
            const preamble = montyPreambleBuild([readTool]);

            const result = await rlmExecute(
                code, preamble, createContext(), resolver, "ralph-loop-test",
                undefined, undefined,
                { plan_path: "/test/plan.md", default_branch: "main", task_number: null },
                [
                    { name: "plan_path", type: "string", nullable: false },
                    { name: "default_branch", type: "string", nullable: true },
                    { name: "task_number", type: "string", nullable: true }
                ]
            );

            expect(execute).toHaveBeenCalledTimes(1);
            expect(result.skipTurn).toBeFalsy();
        });
    });

    describe("plan-execute", () => {
        it("executes without error", async () => {
            const code = await loadTaskCode("plan-execute");
            const { resolver, execute } = createResolver(SAMPLE_PLAN);
            const preamble = montyPreambleBuild([readTool]);

            const result = await rlmExecute(
                code, preamble, createContext(), resolver, "plan-execute-test",
                undefined, undefined,
                { plan_path: "/test/plan.md", default_branch: "main" },
                [
                    { name: "plan_path", type: "string", nullable: false },
                    { name: "default_branch", type: "string", nullable: true }
                ]
            );

            expect(execute).toHaveBeenCalledTimes(1);
            expect(result.skipTurn).toBeFalsy();
        });
    });

    describe("section-execute-commit", () => {
        it("executes without error for task 1", async () => {
            const code = await loadTaskCode("section-execute-commit");
            const { resolver, execute } = createResolver(SAMPLE_PLAN);
            const preamble = montyPreambleBuild([readTool]);

            const result = await rlmExecute(
                code, preamble, createContext(), resolver, "section-exec-test",
                undefined, undefined,
                { plan_path: "/test/plan.md", task_number: "1", default_branch: "main" },
                [
                    { name: "plan_path", type: "string", nullable: false },
                    { name: "task_number", type: "string", nullable: true },
                    { name: "default_branch", type: "string", nullable: true }
                ]
            );

            expect(execute).toHaveBeenCalledTimes(1);
            expect(result.skipTurn).toBeFalsy();
        });
    });

    describe("review-results", () => {
        it("executes without error for a completed task", async () => {
            const completedPlan = SAMPLE_PLAN.replace(
                "- [ ] fix the rendering logic",
                "- [x] fix the rendering logic"
            );
            const code = await loadTaskCode("review-results");
            const { resolver, execute } = createResolver(completedPlan);
            const preamble = montyPreambleBuild([readTool]);

            const result = await rlmExecute(
                code, preamble, createContext(), resolver, "review-results-test",
                undefined, undefined,
                { plan_path: "/test/plan.md", task_number: "1" },
                [
                    { name: "plan_path", type: "string", nullable: false },
                    { name: "task_number", type: "string", nullable: true }
                ]
            );

            expect(execute).toHaveBeenCalledTimes(1);
            expect(result.skipTurn).toBeFalsy();
        });
    });

    describe("software-development", () => {
        it("produces workflow instructions without calling read()", async () => {
            const code = await loadTaskCode("software-development");
            const { resolver, execute } = createResolver("");
            const preamble = montyPreambleBuild([readTool]);

            const result = await rlmExecute(
                code, preamble, createContext(), resolver, "software-dev-test",
                undefined, undefined,
                { user_prompt: "Fix the login bug", plan_path: "/test/plan.md", default_branch: "main" },
                [
                    { name: "user_prompt", type: "string", nullable: false },
                    { name: "plan_path", type: "string", nullable: true },
                    { name: "default_branch", type: "string", nullable: true }
                ]
            );

            // software-development doesn't call read()
            expect(execute).not.toHaveBeenCalled();
            expect(result.skipTurn).toBeFalsy();
        });
    });
});
