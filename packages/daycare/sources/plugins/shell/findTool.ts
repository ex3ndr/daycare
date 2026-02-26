import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { toolExecutionResultOutcomeWithTyped } from "../../engine/modules/tools/toolReturnOutcome.js";
import { shellQuote } from "../../util/shellQuote.js";
import { findEntriesFormat } from "./findEntriesFormat.js";

const FIND_DEFAULT_LIMIT = 1000;
const FIND_MAX_OUTPUT_BYTES = 64 * 1024;
const LOCALHOST_ALLOWED_DOMAINS = ["localhost"];

const findSchema = Type.Object(
    {
        pattern: Type.String({ minLength: 1, description: "Glob pattern, for example '*.ts'" }),
        path: Type.Optional(Type.String({ minLength: 1, description: "Directory to search" })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 5000, description: "Maximum results" }))
    },
    { additionalProperties: false }
);

type FindArgs = Static<typeof findSchema>;

const findResultSchema = Type.Object(
    {
        summary: Type.String(),
        action: Type.String(),
        isError: Type.Boolean(),
        count: Type.Number(),
        truncated: Type.Boolean()
    },
    { additionalProperties: false }
);

type FindResult = Static<typeof findResultSchema>;

const findReturns: ToolResultContract<FindResult> = {
    schema: findResultSchema,
    toLLMText: (result) => result.summary
};

export function buildFindTool(): ToolDefinition {
    return {
        tool: {
            name: "find",
            description:
                "Find files using `fd --glob --hidden` while respecting ignore files. Excludes `.git` and `node_modules`.",
            parameters: findSchema
        },
        returns: findReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as FindArgs;
            const limit = payload.limit ?? FIND_DEFAULT_LIMIT;
            const searchPath = payload.path?.trim() || ".";
            const command = findCommandBuild(payload.pattern, searchPath, limit);

            const execResult = await toolContext.sandbox.exec({
                command,
                allowedDomains: LOCALHOST_ALLOWED_DOMAINS,
                signal: toolContext.abortSignal
            });

            if (execResult.failed) {
                const summary = findFailureSummary(execResult.stderr, execResult.exitCode);
                const toolMessage = buildToolMessage(toolCall, summary, true, {
                    action: "find",
                    count: 0,
                    truncated: false
                });
                return toolExecutionResultOutcomeWithTyped(toolMessage, {
                    summary,
                    action: "find",
                    isError: true,
                    count: 0,
                    truncated: false
                });
            }

            const formatted = findEntriesFormat(
                execResult.stdout,
                toolContext.sandbox.execWorkingDir,
                FIND_MAX_OUTPUT_BYTES
            );
            const summary = formatted.text;
            const toolMessage = buildToolMessage(toolCall, summary, false, {
                action: "find",
                count: formatted.count,
                truncated: formatted.truncated
            });
            return toolExecutionResultOutcomeWithTyped(toolMessage, {
                summary,
                action: "find",
                isError: false,
                count: formatted.count,
                truncated: formatted.truncated
            });
        }
    };
}

function findCommandBuild(pattern: string, searchPath: string, limit: number): string {
    const args = [
        "fd",
        "--glob",
        "--color=never",
        "--hidden",
        "--exclude",
        ".git",
        "--exclude",
        "node_modules",
        "--max-results",
        String(limit),
        pattern,
        searchPath
    ];
    return args.map((entry) => shellQuote(entry)).join(" ");
}

function findFailureSummary(stderr: string, exitCode: number | null): string {
    const body = stderr.trim();
    if (body.length > 0) {
        return `find failed (exit code ${exitCode ?? "unknown"}): ${body}`;
    }
    return `find failed (exit code ${exitCode ?? "unknown"}).`;
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
