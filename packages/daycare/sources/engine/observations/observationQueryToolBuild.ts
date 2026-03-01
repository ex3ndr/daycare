import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import type { ObservationLogRepository } from "../../storage/observationLogRepository.js";
import { type ObservationLogFormatMode, observationLogFormat } from "./observationLogFormat.js";

const observationQuerySchema = Type.Object(
    {
        scopeIds: Type.Optional(
            Type.Array(Type.String({ minLength: 1 }), {
                minItems: 1,
                maxItems: 50,
                description: "Filter by entity scope IDs (matches ANY)"
            })
        ),
        type: Type.Optional(Type.String({ minLength: 1, description: "Filter by event type (exact match)" })),
        source: Type.Optional(
            Type.String({ minLength: 1, description: "Filter by source prefix (e.g. 'agent:' or 'plugin:')" })
        ),
        afterDate: Type.Optional(
            Type.Integer({ minimum: 0, description: "Only events after this unix ms (inclusive)" })
        ),
        beforeDate: Type.Optional(
            Type.Integer({ minimum: 0, description: "Only events before this unix ms (exclusive)" })
        ),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500, description: "Max results (default 50)" })),
        offset: Type.Optional(Type.Integer({ minimum: 0, description: "Skip this many results" })),
        mode: Type.Optional(
            Type.Union([Type.Literal("json"), Type.Literal("short"), Type.Literal("full")], {
                description: "Output format: json (data only), short (one-liners), full (all fields). Default: short"
            })
        )
    },
    { additionalProperties: false }
);

type ObservationQueryArgs = Static<typeof observationQuerySchema>;

const observationQueryResultSchema = Type.Object(
    {
        summary: Type.String(),
        count: Type.Number(),
        mode: Type.String()
    },
    { additionalProperties: false }
);

type ObservationQueryResult = Static<typeof observationQueryResultSchema>;

const observationQueryReturns: ToolResultContract<ObservationQueryResult> = {
    schema: observationQueryResultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the observation_query tool that lets agents read the observation log.
 * Expects: repository is wired to an open database with observation_log tables.
 */
export function observationQueryToolBuild(repository: ObservationLogRepository): ToolDefinition {
    return {
        tool: {
            name: "observation_query",
            description:
                "Query the observation log for events scoped to entities. Filter by scope IDs, event type, source, and date range. Returns observations in short (one-liner), full (all details), or json (data payload) format.",
            parameters: observationQuerySchema
        },
        returns: observationQueryReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as ObservationQueryArgs;
            const mode: ObservationLogFormatMode = payload.mode ?? "short";
            const limit = payload.limit ?? 50;

            const entries = await repository.findMany(toolContext.ctx, {
                type: payload.type,
                source: payload.source,
                scopeIds: payload.scopeIds,
                afterDate: payload.afterDate,
                beforeDate: payload.beforeDate,
                limit,
                offset: payload.offset
            });

            const summary = observationLogFormat(entries, mode);
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: summary }],
                details: { count: entries.length, mode },
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    count: entries.length,
                    mode
                }
            };
        }
    };
}
