import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";

const voiceAgentToolParameterSchema = Type.Object(
    {
        type: Type.String({ minLength: 1 }),
        description: Type.String(),
        required: Type.Optional(Type.Boolean())
    },
    { additionalProperties: false }
);

const voiceAgentToolSchema = Type.Object(
    {
        name: Type.String({ minLength: 1 }),
        description: Type.String({ minLength: 1 }),
        parameters: Type.Optional(Type.Record(Type.String(), voiceAgentToolParameterSchema))
    },
    { additionalProperties: false }
);

const voiceAgentCreateSchema = Type.Object(
    {
        name: Type.String({ minLength: 1 }),
        description: Type.Optional(Type.String()),
        systemPrompt: Type.String({ minLength: 1 }),
        tools: Type.Optional(Type.Array(voiceAgentToolSchema)),
        settings: Type.Optional(Type.Record(Type.String(), Type.Unknown()))
    },
    { additionalProperties: false }
);

const voiceAgentCreateResultSchema = Type.Object(
    {
        summary: Type.String(),
        voiceAgentId: Type.String(),
        name: Type.String()
    },
    { additionalProperties: false }
);

type VoiceAgentCreateArgs = Static<typeof voiceAgentCreateSchema>;
type VoiceAgentCreateResult = Static<typeof voiceAgentCreateResultSchema>;

const voiceAgentCreateReturns: ToolResultContract<VoiceAgentCreateResult> = {
    schema: voiceAgentCreateResultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Creates a new voice agent scoped to the caller's workspace user context.
 * Expects: storage.voiceAgents is available on the active agent system.
 */
export function voiceAgentCreateToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "voice_agent_create",
            description: "Create a reusable voice agent with a system prompt, client tools, and provider settings.",
            parameters: voiceAgentCreateSchema
        },
        returns: voiceAgentCreateReturns,
        hiddenByDefault: true,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as VoiceAgentCreateArgs;
            const now = Date.now();
            const created = await toolContext.agentSystem.storage.voiceAgents.create(toolContext.ctx, {
                id: createId(),
                name: payload.name,
                description: payload.description ?? null,
                systemPrompt: payload.systemPrompt,
                tools:
                    payload.tools?.map((tool) => ({
                        name: tool.name,
                        description: tool.description,
                        parameters: tool.parameters ?? {}
                    })) ?? [],
                settings: payload.settings ?? {},
                createdAt: now,
                updatedAt: now
            });

            const summary = `Created voice agent ${created.id} (${created.name}).`;
            const typedResult: VoiceAgentCreateResult = {
                summary,
                voiceAgentId: created.id,
                name: created.name
            };
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: summary }],
                isError: false,
                timestamp: now
            };

            return {
                toolMessage,
                typedResult
            };
        }
    };
}
