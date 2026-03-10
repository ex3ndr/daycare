import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import type { AcpSessions } from "../../acp/acpSessions.js";

const schema = Type.Object(
    {
        id: Type.String({ minLength: 1, description: "Local ACP session id returned by acp_session_start." }),
        prompt: Type.String({ minLength: 1, description: "Prompt sent to the ACP session." })
    },
    { additionalProperties: false }
);

type AcpSessionMessageArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        answer: Type.String(),
        sessionId: Type.String(),
        stopReason: Type.String()
    },
    { additionalProperties: false }
);

type AcpSessionMessageResult = Static<typeof resultSchema>;

const returns: ToolResultContract<AcpSessionMessageResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.answer
};

/**
 * Builds the acp_session_message tool to prompt an existing ACP session and await its reply.
 * Expects: id references a live ACP session created by acp_session_start.
 */
export function acpSessionMessageToolBuild(
    acpSessions: AcpSessions
): ToolDefinition<typeof schema, AcpSessionMessageResult> {
    return {
        tool: {
            name: "acp_session_message",
            description: "Send a prompt to a live ACP session by id and wait for the adapter to answer.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as AcpSessionMessageArgs;
            const sessionId = payload.id.trim();
            const prompt = payload.prompt.trim();
            if (!sessionId) {
                throw new Error("id is required.");
            }
            if (!prompt) {
                throw new Error("prompt is required.");
            }

            const result = await acpSessions.prompt(sessionId, prompt, toolContext.abortSignal);
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: result.answer }],
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    answer: result.answer,
                    sessionId: result.sessionId,
                    stopReason: result.stopReason
                }
            };
        }
    };
}
