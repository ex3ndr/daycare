import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { SKIP_TOOL_NAME } from "../rlm/rlmConstants.js";

const schema = Type.Object({}, { additionalProperties: false });

const skipResultSchema = Type.Object(
    {
        status: Type.String()
    },
    { additionalProperties: false }
);

type SkipResult = Static<typeof skipResultSchema>;

const skipReturns: ToolResultContract<SkipResult> = {
    schema: skipResultSchema,
    toLLMText: (result) => result.status
};

/**
 * Builds the skip tool that models call to skip a turn.
 * When called, the agent loop stops without further inference.
 */
export function skipToolBuild(): ToolDefinition {
    return {
        tool: {
            name: SKIP_TOOL_NAME,
            description: "Skip this turn. Call when you have nothing useful to do right now.",
            parameters: schema
        },
        returns: skipReturns,
        execute: async (_args, _context, toolCall) => {
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: "Turn skipped" }],
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    status: "skipped"
                }
            };
        }
    };
}
