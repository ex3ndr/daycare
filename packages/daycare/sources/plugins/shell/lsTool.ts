import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { toolExecutionResultOutcomeWithTyped } from "../../engine/modules/tools/toolReturnOutcome.js";
import { shellQuote } from "../../util/shellQuote.js";
import { lsEntriesFormat } from "./lsEntriesFormat.js";

const LS_DEFAULT_LIMIT = 500;
const LS_MAX_OUTPUT_BYTES = 64 * 1024;
const LOCALHOST_ALLOWED_DOMAINS = ["localhost"];

const lsSchema = Type.Object(
    {
        path: Type.Optional(Type.String({ minLength: 1, description: "Directory to list" })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 2000, description: "Maximum entries" }))
    },
    { additionalProperties: false }
);

type LsArgs = Static<typeof lsSchema>;

const lsResultSchema = Type.Object(
    {
        summary: Type.String(),
        action: Type.String(),
        isError: Type.Boolean(),
        count: Type.Number(),
        truncated: Type.Boolean()
    },
    { additionalProperties: false }
);

type LsResult = Static<typeof lsResultSchema>;

const lsReturns: ToolResultContract<LsResult> = {
    schema: lsResultSchema,
    toLLMText: (result) => result.summary
};

export function buildLsTool(): ToolDefinition {
    return {
        tool: {
            name: "ls",
            description: "List directory contents via `ls -1apL`, sorted alphabetically with optional entry limits.",
            parameters: lsSchema
        },
        returns: lsReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as LsArgs;
            const limit = payload.limit ?? LS_DEFAULT_LIMIT;
            const targetPath = toolContext.sandbox.resolveVirtualPath(payload.path?.trim() || ".");
            const command = lsCommandBuild(targetPath);

            const execResult = await toolContext.sandbox.exec({
                command,
                allowedDomains: LOCALHOST_ALLOWED_DOMAINS,
                signal: toolContext.abortSignal
            });

            if (execResult.failed) {
                const summary = lsFailureSummary(execResult.stderr, execResult.exitCode);
                const toolMessage = buildToolMessage(toolCall, summary, true, {
                    action: "ls",
                    count: 0,
                    truncated: false
                });
                return toolExecutionResultOutcomeWithTyped(toolMessage, {
                    summary,
                    action: "ls",
                    isError: true,
                    count: 0,
                    truncated: false
                });
            }

            const formatted = lsEntriesFormat(execResult.stdout, limit, LS_MAX_OUTPUT_BYTES);
            const summary = formatted.text;
            const toolMessage = buildToolMessage(toolCall, summary, false, {
                action: "ls",
                count: formatted.count,
                truncated: formatted.truncated
            });
            return toolExecutionResultOutcomeWithTyped(toolMessage, {
                summary,
                action: "ls",
                isError: false,
                count: formatted.count,
                truncated: formatted.truncated
            });
        }
    };
}

function lsCommandBuild(targetPath: string): string {
    const args = ["ls", "-1apL", targetPath];
    return args.map((entry) => shellQuote(entry)).join(" ");
}

function lsFailureSummary(stderr: string, exitCode: number | null): string {
    const body = stderr.trim();
    if (body.length > 0) {
        return `ls failed (exit code ${exitCode ?? "unknown"}): ${body}`;
    }
    return `ls failed (exit code ${exitCode ?? "unknown"}).`;
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
