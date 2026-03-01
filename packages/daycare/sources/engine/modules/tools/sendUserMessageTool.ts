import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolExecutionContext, ToolResultContract } from "@/types";
import { contextForUser } from "../../agents/context.js";
import { messageBuildUserFacing } from "../../messages/messageBuildUserFacing.js";
import { swarmAgentResolve } from "../../swarms/swarmAgentResolve.js";

const schema = Type.Object(
    {
        text: Type.String({ minLength: 1 }),
        nametag: Type.Optional(Type.String({ minLength: 1 })),
        wait: Type.Optional(Type.Boolean()),
        now: Type.Optional(Type.Boolean())
    },
    { additionalProperties: false }
);

type SendUserMessageArgs = Static<typeof schema>;

type SendUserMessageDeferredPayload =
    | {
          kind: "foreground";
          ctxUserId: string;
          resolvedTarget: string;
          wrappedText: string;
          origin: string;
      }
    | {
          kind: "swarm";
          swarmUserId: string;
          swarmAgentId: string;
          text: string;
          origin: string;
      };

const sendUserMessageResultSchema = Type.Object(
    {
        summary: Type.String(),
        targetAgentId: Type.String(),
        originAgentId: Type.String()
    },
    { additionalProperties: false }
);

type SendUserMessageResult = Static<typeof sendUserMessageResultSchema>;

const sendUserMessageReturns: ToolResultContract<SendUserMessageResult> = {
    schema: sendUserMessageResultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the send_user_message tool for background agents.
 * Posts a <message_for_user> system message to the foreground agent,
 * forcing it to present the content to the user.
 */
export function sendUserMessageToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "send_user_message",
            description:
                "Send a message that must be presented to the user. " +
                "The foreground agent will rephrase and deliver it. " +
                "Use nametag to target a swarm directly.",
            parameters: schema
        },
        returns: sendUserMessageReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as SendUserMessageArgs;
            const descriptor = toolContext.agent.descriptor;
            const origin = toolContext.agent.id;
            const targetNametag = payload.nametag?.trim().toLowerCase() ?? "";

            // Swarm path: wait=true cannot be deferred (needs synchronous response)
            if (targetNametag) {
                return sendSwarmMessage(toolContext, toolCall, {
                    text: payload.text,
                    nametag: targetNametag,
                    wait: payload.wait ?? false,
                    now: payload.now,
                    origin
                });
            }

            // Resolve target: parent agent for child agents, most recent foreground otherwise
            const targetAgentId =
                descriptor.type === "subagent" || descriptor.type === "memory-search"
                    ? descriptor.parentAgentId
                    : undefined;
            const resolvedTarget =
                targetAgentId ?? toolContext.agentSystem.agentFor(toolContext.ctx, "most-recent-foreground");
            if (!resolvedTarget) {
                throw new Error("No foreground agent found to deliver the message.");
            }

            const wrappedText = messageBuildUserFacing(payload.text, origin);

            // Defer sending during Python execution unless now=true
            if (toolContext.pythonExecution && !payload.now) {
                const summary = "Message deferred for user delivery.";
                const toolMessage: ToolResultMessage = {
                    role: "toolResult",
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                    content: [{ type: "text", text: summary }],
                    isError: false,
                    timestamp: Date.now()
                };
                const deferredPayload: SendUserMessageDeferredPayload = {
                    kind: "foreground",
                    ctxUserId: toolContext.ctx.userId,
                    resolvedTarget,
                    wrappedText,
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

            await toolContext.agentSystem.post(
                toolContext.ctx,
                { agentId: resolvedTarget },
                {
                    type: "system_message",
                    text: wrappedText,
                    origin
                }
            );

            const summary = "Message queued for user delivery.";
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
            const p = payload as SendUserMessageDeferredPayload;
            if (p.kind === "foreground") {
                await context.agentSystem.post(
                    { userId: p.ctxUserId, agentId: context.agent.ctx.agentId },
                    { agentId: p.resolvedTarget },
                    {
                        type: "system_message",
                        text: p.wrappedText,
                        origin: p.origin
                    }
                );
            } else {
                const swarmCtx = contextForUser({ userId: p.swarmUserId });
                await context.agentSystem.post(
                    swarmCtx,
                    { agentId: p.swarmAgentId },
                    {
                        type: "system_message",
                        text: p.text,
                        origin: p.origin
                    }
                );
            }
        }
    };
}

type SendSwarmMessageInput = {
    text: string;
    nametag: string;
    wait: boolean;
    now?: boolean;
    origin: string;
};

async function sendSwarmMessage(
    toolContext: Parameters<NonNullable<ToolDefinition["execute"]>>[1],
    toolCall: { id: string; name: string },
    input: SendSwarmMessageInput
): Promise<{
    toolMessage: ToolResultMessage;
    typedResult: SendUserMessageResult;
    deferredPayload?: unknown;
}> {
    const targetUser = await toolContext.agentSystem.storage.users.findByNametag(input.nametag);
    if (!targetUser) {
        throw new Error(`User not found for nametag: ${input.nametag}`);
    }
    if (!targetUser.isSwarm) {
        throw new Error(`Target is not a swarm: ${input.nametag}`);
    }

    const resolved = await swarmAgentResolve({
        swarmUserId: targetUser.id,
        contactAgentId: toolContext.agent.id,
        agentSystem: toolContext.agentSystem
    });
    await toolContext.agentSystem.storage.swarmContacts.recordReceived(targetUser.id, toolContext.agent.id);

    const messageText = input.text.trim();
    if (!messageText) {
        throw new Error("text is required.");
    }
    const swarmCtx = contextForUser({ userId: targetUser.id });
    const item = {
        type: "system_message" as const,
        text: messageText,
        origin: input.origin
    };

    // Defer swarm sends during Python execution (auto-bypass when wait=true since we need the response)
    if (toolContext.pythonExecution && !input.now && !input.wait) {
        const summary = `Message to swarm @${input.nametag} deferred.`;
        const toolMessage: ToolResultMessage = {
            role: "toolResult",
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            content: [{ type: "text", text: summary }],
            isError: false,
            timestamp: Date.now()
        };
        const deferredPayload: SendUserMessageDeferredPayload = {
            kind: "swarm",
            swarmUserId: targetUser.id,
            swarmAgentId: resolved.swarmAgentId,
            text: messageText,
            origin: input.origin
        };
        return {
            toolMessage,
            typedResult: {
                summary,
                targetAgentId: resolved.swarmAgentId,
                originAgentId: input.origin
            },
            deferredPayload
        };
    }

    let summary = `Message sent to swarm @${input.nametag}.`;
    if (input.wait) {
        const result = await toolContext.agentSystem.postAndAwait(swarmCtx, { agentId: resolved.swarmAgentId }, item);
        if (result.type === "message" || result.type === "system_message") {
            summary =
                result.responseText && result.responseText.trim().length > 0
                    ? `${result.responseText}\n\nSwarm agent id: ${resolved.swarmAgentId}`
                    : `Swarm @${input.nametag} completed without a text response. Swarm agent id: ${resolved.swarmAgentId}`;
        }
    } else {
        await toolContext.agentSystem.post(swarmCtx, { agentId: resolved.swarmAgentId }, item);
    }

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
        typedResult: {
            summary,
            targetAgentId: resolved.swarmAgentId,
            originAgentId: input.origin
        }
    };
}
