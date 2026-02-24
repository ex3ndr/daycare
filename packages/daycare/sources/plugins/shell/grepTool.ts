import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { toolExecutionResultOutcomeWithTyped } from "../../engine/modules/tools/toolReturnOutcome.js";
import { shellQuote } from "../../util/shellQuote.js";
import { grepResultsFormat } from "./grepResultsFormat.js";

const GREP_DEFAULT_LIMIT = 100;
const GREP_MAX_OUTPUT_BYTES = 64 * 1024;
const LOCALHOST_ALLOWED_DOMAINS = ["localhost"];

const grepSchema = Type.Object(
    {
        pattern: Type.String({ minLength: 1, description: "Regex pattern to search for" }),
        path: Type.Optional(Type.String({ minLength: 1, description: "Directory or file to search" })),
        glob: Type.Optional(Type.String({ minLength: 1, description: "Glob filter, for example '*.ts'" })),
        ignoreCase: Type.Optional(Type.Boolean({ description: "Case-insensitive search" })),
        context: Type.Optional(Type.Number({ minimum: 0, maximum: 10, description: "Context lines around matches" })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 500, description: "Maximum matches to return" }))
    },
    { additionalProperties: false }
);

type GrepArgs = Static<typeof grepSchema>;

const grepResultSchema = Type.Object(
    {
        summary: Type.String(),
        action: Type.String(),
        isError: Type.Boolean(),
        count: Type.Number(),
        truncated: Type.Boolean()
    },
    { additionalProperties: false }
);

type GrepResult = Static<typeof grepResultSchema>;

const grepReturns: ToolResultContract<GrepResult> = {
    schema: grepResultSchema,
    toLLMText: (result) => result.summary
};

export function buildGrepTool(): ToolDefinition {
    return {
        tool: {
            name: "grep",
            description:
                "Search file contents using ripgrep (`rg`) and return matches as file:line:content rows. Supports glob filters, case-insensitive mode, and context lines.",
            parameters: grepSchema
        },
        returns: grepReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as GrepArgs;
            const limit = payload.limit ?? GREP_DEFAULT_LIMIT;
            const searchPath = payload.path?.trim() || ".";
            const command = grepCommandBuild(payload, searchPath, limit);

            const execResult = await toolContext.sandbox.exec({
                command,
                allowedDomains: LOCALHOST_ALLOWED_DOMAINS
            });

            if (execResult.failed && execResult.exitCode !== 1) {
                const summary = grepFailureSummary(execResult.stderr, execResult.exitCode);
                const toolMessage = buildToolMessage(toolCall, summary, true, {
                    action: "grep",
                    count: 0,
                    truncated: false
                });
                return toolExecutionResultOutcomeWithTyped(toolMessage, {
                    summary,
                    action: "grep",
                    isError: true,
                    count: 0,
                    truncated: false
                });
            }

            const formatted = grepResultsFormat(
                execResult.stdout,
                toolContext.sandbox.workingDir,
                GREP_MAX_OUTPUT_BYTES
            );
            const summary = formatted.text;
            const toolMessage = buildToolMessage(toolCall, summary, false, {
                action: "grep",
                count: formatted.count,
                truncated: formatted.truncated
            });
            return toolExecutionResultOutcomeWithTyped(toolMessage, {
                summary,
                action: "grep",
                isError: false,
                count: formatted.count,
                truncated: formatted.truncated
            });
        }
    };
}

function grepCommandBuild(payload: GrepArgs, searchPath: string, limit: number): string {
    const args = ["rg", "--json", "--color=never", "--max-count", String(limit)];
    if (payload.ignoreCase) {
        args.push("-i");
    }
    if (payload.glob) {
        args.push("-g", payload.glob);
    }
    if (payload.context !== undefined) {
        args.push("-C", String(payload.context));
    }
    args.push(payload.pattern, searchPath);
    return args.map((entry) => shellQuote(entry)).join(" ");
}

function grepFailureSummary(stderr: string, exitCode: number | null): string {
    const body = stderr.trim();
    if (body.length > 0) {
        return `grep failed (exit code ${exitCode ?? "unknown"}): ${body}`;
    }
    return `grep failed (exit code ${exitCode ?? "unknown"}).`;
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
