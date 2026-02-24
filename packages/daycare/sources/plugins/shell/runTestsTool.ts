import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import {
    toolExecutionResultOutcomeWithTyped,
    toolMessageTextExtract
} from "../../engine/modules/tools/toolReturnOutcome.js";
import { formatExecOutput } from "./tool.js";

const RUN_TESTS_DEFAULT_COMMAND = "yarn test";
const RUN_TESTS_DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const RUN_TESTS_ALLOWED_DOMAINS = ["localhost"];

const runTestsSchema = Type.Object(
    {
        command: Type.Optional(Type.String({ minLength: 1, description: "Optional test command override." })),
        cwd: Type.Optional(Type.String({ minLength: 1, description: "Optional workspace-relative test directory." })),
        timeoutMs: Type.Optional(
            Type.Number({ minimum: 1_000, maximum: 60 * 60 * 1000, description: "Optional timeout override." })
        )
    },
    { additionalProperties: false }
);

type RunTestsArgs = Static<typeof runTestsSchema>;

const runTestsResultSchema = Type.Object(
    {
        summary: Type.String(),
        action: Type.String(),
        isError: Type.Boolean(),
        cwd: Type.Optional(Type.String()),
        exitCode: Type.Optional(Type.Number()),
        signal: Type.Optional(Type.String())
    },
    { additionalProperties: false }
);

type RunTestsResult = Static<typeof runTestsResultSchema>;

const runTestsReturns: ToolResultContract<RunTestsResult> = {
    schema: runTestsResultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Runs project tests from the current workspace.
 * Expects: sandbox exec is available and command resolves within the workspace.
 */
export function buildRunTestsTool(): ToolDefinition {
    return {
        tool: {
            name: "run_tests",
            description: "Run tests inside the workspace (defaults to `yarn test`). Disabled in CI environments.",
            parameters: runTestsSchema
        },
        returns: runTestsReturns,
        visibleByDefault: () => !ciEnvironmentIs(),
        execute: async (args, toolContext, toolCall) => {
            if (ciEnvironmentIs()) {
                throw new Error("run_tests is disabled when CI is enabled.");
            }

            const payload = args as RunTestsArgs;
            const workingDir = toolContext.sandbox.workingDir;
            const result = await toolContext.sandbox.exec({
                command: payload.command ?? RUN_TESTS_DEFAULT_COMMAND,
                cwd: payload.cwd,
                timeoutMs: payload.timeoutMs ?? RUN_TESTS_DEFAULT_TIMEOUT_MS,
                allowedDomains: RUN_TESTS_ALLOWED_DOMAINS
            });
            const text = formatExecOutput(result.stdout, result.stderr, result.failed);
            const toolMessage = buildToolMessage(toolCall, text, result.failed, {
                action: "run_tests",
                cwd: path.relative(workingDir, result.cwd) || ".",
                exitCode: result.exitCode,
                signal: result.signal
            });
            return toolExecutionResultOutcomeWithTyped(toolMessage, runTestsResultBuild(toolMessage));
        }
    };
}

function ciEnvironmentIs(): boolean {
    const raw = process.env.CI;
    if (!raw) {
        return false;
    }
    const normalized = raw.trim().toLowerCase();
    return normalized.length > 0 && normalized !== "0" && normalized !== "false";
}

function buildToolMessage(
    toolCall: { id: string; name: string },
    text: string,
    isError: boolean,
    details?: Record<string, unknown>
): ToolResultMessage {
    return {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text }],
        details,
        isError,
        timestamp: Date.now()
    };
}

function runTestsResultBuild(message: ToolResultMessage): RunTestsResult {
    const details = detailRecordGet(message.details);
    return {
        summary: toolMessageTextExtract(message),
        action: "run_tests",
        isError: Boolean(message.isError),
        ...(detailStringGet(details, "cwd") ? { cwd: detailStringGet(details, "cwd") } : {}),
        ...(detailNumberGet(details, "exitCode") !== undefined
            ? { exitCode: detailNumberGet(details, "exitCode") }
            : {}),
        ...(detailStringGet(details, "signal") ? { signal: detailStringGet(details, "signal") } : {})
    };
}

function detailRecordGet(value: unknown): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
}

function detailStringGet(details: Record<string, unknown>, key: string): string | undefined {
    const value = details[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function detailNumberGet(details: Record<string, unknown>, key: string): number | undefined {
    const value = details[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
