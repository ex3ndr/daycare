import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolExecutionContext, ToolResultContract } from "@/types";
import { buildWriteOutputTool } from "../../../plugins/shell/writeOutputTool.js";
import { agentPathChildAllocate } from "../../agents/ops/agentPathChildAllocate.js";

const AGENT_MESSAGE_INLINE_CHAR_LIMIT = 8_000;

const startSchema = Type.Object(
    {
        prompt: Type.String({ minLength: 1 }),
        name: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

const sendSchema = Type.Object(
    {
        text: Type.String({ minLength: 1 }),
        agentId: Type.Optional(Type.String({ minLength: 1 })),
        steering: Type.Optional(Type.Boolean()),
        cancelReason: Type.Optional(Type.String({ minLength: 1 })),
        now: Type.Optional(Type.Boolean())
    },
    { additionalProperties: false }
);

type SendAgentMessageDeferredPayload = {
    deliveryContextUserId: string;
    resolvedTarget: string;
    text: string;
    origin: string;
};

type StartBackgroundArgs = Static<typeof startSchema>;
type SendAgentMessageArgs = Static<typeof sendSchema>;

const backgroundResultSchema = Type.Object(
    {
        summary: Type.String(),
        targetAgentId: Type.String(),
        originAgentId: Type.String()
    },
    { additionalProperties: false }
);

type BackgroundResult = Static<typeof backgroundResultSchema>;

const backgroundReturns: ToolResultContract<BackgroundResult> = {
    schema: backgroundResultSchema,
    toLLMText: (result) => result.summary
};

export function buildStartBackgroundAgentTool(): ToolDefinition {
    return {
        tool: {
            name: "start_background_agent",
            description: "Start a background agent to work on a task.",
            parameters: startSchema
        },
        returns: backgroundReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as StartBackgroundArgs;
            const prompt = payload.prompt.trim();
            const requestedName = payload.name?.trim() ?? "";
            if (!prompt) {
                throw new Error("Background agent prompt is required");
            }

            const path = await agentPathChildAllocate({
                storage: toolContext.agentSystem.storage,
                parentAgentId: toolContext.agent.id,
                kind: "sub"
            });
            const agentId = await toolContext.agentSystem.agentIdForTarget(
                toolContext.ctx,
                { path },
                {
                    kind: "sub",
                    parentAgentId: toolContext.agent.id,
                    name: requestedName || null
                }
            );
            await toolContext.agentSystem.post(
                toolContext.ctx,
                { agentId },
                { type: "message", message: { text: prompt }, context: {} }
            );

            const summary = requestedName
                ? `Background agent started (${requestedName}): ${agentId}.`
                : `Background agent started: ${agentId}.`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [
                    {
                        type: "text",
                        text: summary
                    }
                ],
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    targetAgentId: agentId,
                    originAgentId: toolContext.agent.id
                }
            };
        }
    };
}

export function buildSendAgentMessageTool(): ToolDefinition {
    return {
        tool: {
            name: "send_agent_message",
            description:
                "Send a system message to another agent (defaults to parent for child agents, otherwise most recent foreground agent). Set steering=true to interrupt the agent's current work.",
            parameters: sendSchema
        },
        returns: backgroundReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as SendAgentMessageArgs;
            const outbound = await agentMessageOverflowHandle(payload.text, toolContext);
            const origin = toolContext.agent.id;
            const kind = toolContext.agent.config.kind ?? "agent";
            const parentAgentId = toolContext.agent.config.parentAgentId ?? null;
            const targetAgentId =
                payload.agentId ?? (kind === "sub" || kind === "search" ? (parentAgentId ?? undefined) : undefined);
            const resolvedTarget =
                targetAgentId ?? toolContext.agentSystem.agentFor(toolContext.ctx, "most-recent-foreground");
            if (!resolvedTarget) {
                throw new Error("No recent foreground agent found.");
            }

            // If steering flag is set, use steering delivery
            if (payload.steering) {
                const exists = await toolContext.agentSystem.agentExists(resolvedTarget);
                if (!exists) {
                    throw new Error(`Agent not found: ${resolvedTarget}`);
                }

                await toolContext.agentSystem.steer(toolContext.ctx, resolvedTarget, {
                    type: "steering",
                    text: outbound.text,
                    origin,
                    cancelReason: payload.cancelReason
                });

                const summary = outbound.outputPath
                    ? `Steering message delivered. Full content saved to ${outbound.outputPath}.`
                    : "Steering message delivered.";
                const toolMessage: ToolResultMessage = {
                    role: "toolResult",
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                    content: [
                        {
                            type: "text",
                            text: summary
                        }
                    ],
                    isError: false,
                    timestamp: Date.now()
                };

                return {
                    toolMessage,
                    typedResult: {
                        summary,
                        targetAgentId: resolvedTarget,
                        originAgentId: origin
                    }
                };
            }

            // Defer normal system message during Python execution unless now=true
            // (steering is always immediate — time-sensitive interrupt)
            if (toolContext.pythonExecution && !payload.now) {
                const summary = "System message deferred.";
                const toolMessage: ToolResultMessage = {
                    role: "toolResult",
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                    content: [{ type: "text", text: summary }],
                    isError: false,
                    timestamp: Date.now()
                };
                const deferredPayload: SendAgentMessageDeferredPayload = {
                    deliveryContextUserId: toolContext.ctx.userId,
                    resolvedTarget,
                    text: outbound.text,
                    origin
                };
                return {
                    toolMessage,
                    typedResult: {
                        summary,
                        targetAgentId: resolvedTarget,
                        originAgentId: origin
                    },
                    deferredPayload
                };
            }

            // Normal system message delivery
            await toolContext.agentSystem.post(
                toolContext.ctx,
                { agentId: resolvedTarget },
                { type: "system_message", text: outbound.text, origin }
            );

            const summary = outbound.outputPath
                ? `System message sent. Full content saved to ${outbound.outputPath}.`
                : "System message sent.";
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [
                    {
                        type: "text",
                        text: summary
                    }
                ],
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    targetAgentId: resolvedTarget,
                    originAgentId: origin
                }
            };
        },
        executeDeferred: async (payload: unknown, context: ToolExecutionContext) => {
            const p = payload as SendAgentMessageDeferredPayload;
            const deliveryContext = { userId: p.deliveryContextUserId, agentId: context.agent.ctx.agentId };
            await context.agentSystem.post(
                deliveryContext,
                { agentId: p.resolvedTarget },
                { type: "system_message", text: p.text, origin: p.origin }
            );
        }
    };
}

type AgentMessageOverflowResult = {
    text: string;
    outputPath: string | null;
};

async function agentMessageOverflowHandle(
    text: string,
    toolContext: ToolExecutionContext
): Promise<AgentMessageOverflowResult> {
    if (text.length <= AGENT_MESSAGE_INLINE_CHAR_LIMIT) {
        return { text, outputPath: null };
    }

    const writeOutput = buildWriteOutputTool();
    const writeResult = await writeOutput.execute(
        {
            name: `agent-message-${createId()}`,
            format: "markdown",
            content: text
        },
        toolContext,
        { id: createId(), name: "write_output" }
    );
    const outputPath = writeOutputPathResolve(writeResult.typedResult);
    const referenceText = [
        `Message exceeded ${AGENT_MESSAGE_INLINE_CHAR_LIMIT} characters (${text.length} chars).`,
        `Full content was written to ${outputPath}.`,
        `Read that file to access the complete message.`
    ].join(" ");

    return {
        text: referenceText,
        outputPath
    };
}

function writeOutputPathResolve(value: unknown): string {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("write_output returned invalid result.");
    }
    const path = (value as { path?: unknown }).path;
    if (typeof path !== "string" || path.length === 0) {
        throw new Error("write_output result path is missing.");
    }
    return path;
}
