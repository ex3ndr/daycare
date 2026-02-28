import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { BUILTIN_MODEL_FLAVORS } from "../../../settings.js";
import type { AgentModelOverride } from "../../agents/ops/agentTypes.js";
import type { ConfigModule } from "../../config/configModule.js";

const schema = Type.Object(
    {
        agentId: Type.String({ minLength: 1 }),
        model: Type.String({ minLength: 1 })
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
                "Set the inference model flavor for an agent in the same user scope. Built-ins: small, normal, large. Custom flavors from settings.modelFlavors are also allowed.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type === "user",
        execute: async (args, toolContext, toolCall) => {
            const payload = args as AgentModelSetArgs;
            const targetAgentId = payload.agentId;
            const selector = agentModelSelectorParse(payload.model, toolContext.agentSystem.config);

            if (!selector) {
                throw new Error(
                    'Model flavor must be one of built-ins ("small", "normal", "large") or a configured custom flavor.'
                );
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

function agentModelSelectorParse(value: string, config: ConfigModule): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    const normalized = trimmed.toLowerCase();
    if (normalized in BUILTIN_MODEL_FLAVORS) {
        return normalized;
    }

    const modelFlavors = config.current.settings.modelFlavors ?? {};
    if (trimmed in modelFlavors) {
        return trimmed;
    }

    const flavorKey = Object.keys(modelFlavors).find((key) => key.toLowerCase() === normalized);
    return flavorKey ?? null;
}
