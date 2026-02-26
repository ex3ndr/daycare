import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import type { AgentModelOverride } from "../../agents/ops/agentTypes.js";

const MODEL_SELECTORS = ["small", "normal", "large"] as const;

type AgentModelSelector = (typeof MODEL_SELECTORS)[number];

const schema = Type.Object(
    {
        agentId: Type.String({ minLength: 1 }),
        model: Type.Union([Type.Literal("small"), Type.Literal("normal"), Type.Literal("large")])
    },
    { additionalProperties: false }
);

type AgentModelSetArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String()
    },
    { additionalProperties: false }
);

type AgentModelSetResult = Static<typeof resultSchema>;

const returns: ToolResultContract<AgentModelSetResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the set_agent_model tool.
 * Lets a foreground agent change any agent's inference selector.
 */
export function agentModelSetToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "set_agent_model",
            description:
                'Set the inference selector for an agent in the same user scope. Allowed values: "small", "normal", "large".',
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type === "user",
        execute: async (args, toolContext, toolCall) => {
            const payload = args as AgentModelSetArgs;
            const targetAgentId = payload.agentId;
            const selector = agentModelSelectorParse(payload.model);

            if (!selector) {
                throw new Error('Model selector must be one of "small", "normal", "large".');
            }

            const targetCtx = await toolContext.agentSystem.contextForAgentId(targetAgentId);
            if (!targetCtx) {
                throw new Error(`Agent not found or not loaded: ${targetAgentId}`);
            }
            if (targetCtx.userId !== toolContext.ctx.userId) {
                throw new Error(`Cannot change model for agent from another user: ${targetAgentId}`);
            }

            const override: AgentModelOverride = { type: "selector", value: selector };
            const updated = await toolContext.agentSystem.updateAgentModelOverride(targetAgentId, override);
            if (!updated) {
                throw new Error(`Agent not found or not loaded: ${targetAgentId}`);
            }

            const summary = `Model selector set to "${override.value}" for agent ${targetAgentId}.`;

            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: summary }],
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: { summary }
            };
        }
    };
}

function agentModelSelectorParse(value: string): AgentModelSelector | null {
    const normalized = value.trim().toLowerCase();
    return MODEL_SELECTORS.includes(normalized as AgentModelSelector) ? (normalized as AgentModelSelector) : null;
}
