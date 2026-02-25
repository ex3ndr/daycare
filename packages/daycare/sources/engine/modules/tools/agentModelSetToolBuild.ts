import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { listActiveInferenceProviders } from "../../../providers/catalog.js";
import type { ProviderSettings } from "../../../settings.js";
import type { AgentModelOverride } from "../../agents/ops/agentTypes.js";
import type { InferenceRouter } from "../inference/router.js";

const SELECTORS = new Set(["small", "normal", "big"]);

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
 * Lets a foreground agent change any agent's inference model.
 *
 * Expects: inferenceRouter is available for model validation calls.
 */
export function agentModelSetToolBuild(inferenceRouter: InferenceRouter): ToolDefinition {
    return {
        tool: {
            name: "set_agent_model",
            description:
                'Set the inference model for an agent in the same user scope. Use a selector ("small", "normal", "big") or a direct model name. Direct model names are validated before applying.',
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type === "user",
        execute: async (args, toolContext, toolCall) => {
            const payload = args as AgentModelSetArgs;
            const targetAgentId = payload.agentId;
            const model = payload.model.trim();

            if (!model) {
                throw new Error("Model value is required");
            }
            const targetCtx = await toolContext.agentSystem.contextForAgentId(targetAgentId);
            if (!targetCtx) {
                throw new Error(`Agent not found or not loaded: ${targetAgentId}`);
            }
            if (targetCtx.userId !== toolContext.ctx.userId) {
                throw new Error(`Cannot change model for agent from another user: ${targetAgentId}`);
            }

            let override: AgentModelOverride;

            if (SELECTORS.has(model)) {
                override = { type: "selector", value: model as "small" | "normal" | "big" };
            } else {
                // Validate direct model name with a micro inference call
                const providers = listActiveInferenceProviders(toolContext.agentSystem.config.current.settings);
                if (providers.length === 0) {
                    throw new Error("No inference provider available for model validation");
                }
                await validateModelName(inferenceRouter, providers[0]!, model);
                override = { type: "model", value: model };
            }

            const updated = await toolContext.agentSystem.updateAgentModelOverride(targetAgentId, override);
            if (!updated) {
                throw new Error(`Agent not found or not loaded: ${targetAgentId}`);
            }

            const summary =
                override.type === "selector"
                    ? `Model set to "${override.value}" selector for agent ${targetAgentId}.`
                    : `Model set to "${override.value}" for agent ${targetAgentId}.`;

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

/**
 * Validates a direct model name by performing a micro inference call.
 * Uses the first active provider with the model name overridden.
 *
 * Throws if the model is not reachable.
 */
async function validateModelName(
    inferenceRouter: InferenceRouter,
    provider: ProviderSettings,
    model: string
): Promise<void> {
    const sessionId = `model-validation:${createId()}`;
    try {
        await inferenceRouter.complete(
            {
                messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
                systemPrompt: "Reply with 'ok'."
            },
            sessionId,
            {
                providersOverride: [{ ...provider, model }]
            }
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Model validation failed for "${model}": ${message}`);
    }
}
