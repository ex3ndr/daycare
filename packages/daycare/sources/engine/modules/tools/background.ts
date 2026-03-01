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
    swarmContactTarget: string | null;
    senderUserId: string;
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
                "Send a system message to another agent (defaults to parent for child agents, latest swarm contact for swarms, otherwise most recent foreground agent). Set steering=true to interrupt the agent's current work.",
            parameters: sendSchema
        },
        returns: backgroundReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as SendAgentMessageArgs;
            const outbound = await agentMessageOverflowHandle(payload.text, toolContext);
            const origin = toolContext.agent.id;
            const kind = agentKindResolve(toolContext);
            const parentAgentId = await parentAgentIdResolve(toolContext);
            const defaultSwarmContactTarget = await swarmContactDefaultTargetResolve(kind, toolContext);
            const targetAgentId =
                payload.agentId ??
                (kind === "sub" || kind === "search"
                    ? (parentAgentId ?? undefined)
                    : (defaultSwarmContactTarget ?? undefined));
            const resolvedTarget =
                targetAgentId ?? toolContext.agentSystem.agentFor(toolContext.ctx, "most-recent-foreground");
            if (!resolvedTarget) {
                if (swarmAgentIs(toolContext)) {
                    throw new Error("No known swarm contacts found. Provide agentId or wait for an inbound message.");
                }
                throw new Error("No recent foreground agent found.");
            }
            const deliveryContext = await agentMessageDeliveryContextResolve(kind, toolContext, resolvedTarget);
            const swarmContactTarget = await swarmContactTargetResolve(
                kind,
                toolContext,
                resolvedTarget,
                deliveryContext
            );

            // If steering flag is set, use steering delivery
            if (payload.steering) {
                const exists = await toolContext.agentSystem.agentExists(resolvedTarget);
                if (!exists) {
                    throw new Error(`Agent not found: ${resolvedTarget}`);
                }

                await toolContext.agentSystem.steer(deliveryContext, resolvedTarget, {
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
                if (swarmContactTarget) {
                    await toolContext.agentSystem.storage.swarmContacts.recordSent(
                        toolContext.agent.userId,
                        swarmContactTarget
                    );
                }

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
                    deliveryContextUserId: deliveryContext.userId,
                    resolvedTarget,
                    text: outbound.text,
                    origin,
                    swarmContactTarget,
                    senderUserId: toolContext.agent.userId
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
                deliveryContext,
                { agentId: resolvedTarget },
                { type: "system_message", text: outbound.text, origin }
            );
            if (swarmContactTarget) {
                await toolContext.agentSystem.storage.swarmContacts.recordSent(
                    toolContext.agent.userId,
                    swarmContactTarget
                );
            }

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
            if (p.swarmContactTarget) {
                await context.agentSystem.storage.swarmContacts.recordSent(p.senderUserId, p.swarmContactTarget);
            }
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

async function agentMessageDeliveryContextResolve(
    sourceKind: NonNullable<ToolExecutionContext["agent"]["config"]["kind"]> | "agent",
    toolContext: ToolExecutionContext,
    targetAgentId: string
): Promise<ToolExecutionContext["ctx"]> {
    if (sourceKind !== "swarm") {
        return toolContext.ctx;
    }
    const targetContext = await toolContext.agentSystem.contextForAgentId(targetAgentId);
    if (!targetContext) {
        throw new Error(`Agent not found: ${targetAgentId}`);
    }
    return targetContext;
}

async function swarmContactDefaultTargetResolve(
    sourceKind: NonNullable<ToolExecutionContext["agent"]["config"]["kind"]> | "agent",
    toolContext: ToolExecutionContext
): Promise<string | null> {
    if (sourceKind !== "swarm") {
        return null;
    }
    const contacts = await toolContext.agentSystem.storage.swarmContacts.listContacts(toolContext.agent.userId);
    return contacts[0]?.contactAgentId ?? null;
}

async function swarmContactTargetResolve(
    sourceKind: NonNullable<ToolExecutionContext["agent"]["config"]["kind"]> | "agent",
    toolContext: ToolExecutionContext,
    targetAgentId: string,
    deliveryContext: ToolExecutionContext["ctx"]
): Promise<string | null> {
    if (sourceKind !== "swarm") {
        return null;
    }
    if (deliveryContext.userId === toolContext.ctx.userId) {
        return null;
    }
    const known = await toolContext.agentSystem.storage.swarmContacts.isKnownContact(
        toolContext.agent.userId,
        targetAgentId
    );
    if (!known) {
        throw new Error("Can only message agents that have contacted this swarm");
    }
    return targetAgentId;
}

async function parentAgentIdResolve(toolContext: ToolExecutionContext): Promise<string | null> {
    return toolContext.agent.config.parentAgentId ?? null;
}

function swarmAgentIs(toolContext: ToolExecutionContext): boolean {
    return agentKindResolve(toolContext) === "swarm";
}

function agentKindResolve(
    toolContext: ToolExecutionContext
): NonNullable<ToolExecutionContext["agent"]["config"]["kind"]> {
    return toolContext.agent.config.kind ?? "agent";
}
