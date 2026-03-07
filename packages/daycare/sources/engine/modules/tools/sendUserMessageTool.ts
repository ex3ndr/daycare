import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolExecutionContext, ToolResultContract } from "@/types";
import { contextForUser } from "../../agents/context.js";
import { messageBuildUserFacing } from "../../messages/messageBuildUserFacing.js";
import { workspaceAgentResolve } from "../../workspaces/workspaceAgentResolve.js";

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
          kind: "workspace";
          workspaceUserId: string;
          workspaceAgentId: string;
          contactAgentId: string;
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
                "Use nametag to target a workspace directly.",
            parameters: schema
        },
        returns: sendUserMessageReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as SendUserMessageArgs;
            const origin = toolContext.agent.id;
            const targetNametag = payload.nametag?.trim().toLowerCase() ?? "";

            // Workspace path: wait=true cannot be deferred (needs synchronous response)
            if (targetNametag) {
                return sendWorkspaceMessage(toolContext, toolCall, {
                    text: payload.text,
                    nametag: targetNametag,
                    wait: payload.wait ?? false,
                    now: payload.now,
                    origin
                });
            }

            // Resolve target: parent agent for child agents, most recent foreground otherwise
            const kind = toolContext.agent.config.kind ?? "agent";
            const parentAgentId = await parentAgentIdResolve(toolContext, kind);
            const targetAgentId = kind === "sub" || kind === "search" ? (parentAgentId ?? undefined) : undefined;
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
                const workspaceCtx = contextForUser({ userId: p.workspaceUserId });
                await context.agentSystem.storage.workspaceContacts.recordReceived(p.workspaceUserId, p.contactAgentId);
                await context.agentSystem.post(
                    workspaceCtx,
                    { agentId: p.workspaceAgentId },
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

async function parentAgentIdResolve(
    toolContext: Parameters<NonNullable<ToolDefinition["execute"]>>[1],
    kind: string
): Promise<string | null> {
    return kind === "sub" || kind === "search" ? (toolContext.agent.config.parentAgentId ?? null) : null;
}

type SendWorkspaceMessageInput = {
    text: string;
    nametag: string;
    wait: boolean;
    now?: boolean;
    origin: string;
};

async function sendWorkspaceMessage(
    toolContext: Parameters<NonNullable<ToolDefinition["execute"]>>[1],
    toolCall: { id: string; name: string },
    input: SendWorkspaceMessageInput
): Promise<{
    toolMessage: ToolResultMessage;
    typedResult: SendUserMessageResult;
    deferredPayload?: unknown;
}> {
    const targetUser = await toolContext.agentSystem.storage.users.findByNametag(input.nametag);
    if (!targetUser) {
        throw new Error(`User not found for nametag: ${input.nametag}`);
    }
    if (!targetUser.isWorkspace) {
        throw new Error(`Target is not a workspace: ${input.nametag}`);
    }

    const resolved = await workspaceAgentResolve({
        workspaceUserId: targetUser.id,
        contactAgentId: toolContext.agent.id,
        agentSystem: toolContext.agentSystem
    });

    const messageText = input.text.trim();
    if (!messageText) {
        throw new Error("text is required.");
    }
    const workspaceCtx = contextForUser({ userId: targetUser.id });
    const item = {
        type: "system_message" as const,
        text: messageText,
        origin: input.origin
    };

    // Defer workspace sends during Python execution (auto-bypass when wait=true since we need the response)
    if (toolContext.pythonExecution && !input.now && !input.wait) {
        const summary = `Message to workspace @${input.nametag} deferred.`;
        const toolMessage: ToolResultMessage = {
            role: "toolResult",
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            content: [{ type: "text", text: summary }],
            isError: false,
            timestamp: Date.now()
        };
        const deferredPayload: SendUserMessageDeferredPayload = {
            kind: "workspace",
            workspaceUserId: targetUser.id,
            workspaceAgentId: resolved.workspaceAgentId,
            contactAgentId: toolContext.agent.id,
            text: messageText,
            origin: input.origin
        };
        return {
            toolMessage,
            typedResult: {
                summary,
                targetAgentId: resolved.workspaceAgentId,
                originAgentId: input.origin
            },
            deferredPayload
        };
    }

    await toolContext.agentSystem.storage.workspaceContacts.recordReceived(targetUser.id, toolContext.agent.id);

    let summary = `Message sent to workspace @${input.nametag}.`;
    if (input.wait) {
        const result = await toolContext.agentSystem.postAndAwait(
            workspaceCtx,
            { agentId: resolved.workspaceAgentId },
            item
        );
        if (result.type === "message" || result.type === "system_message") {
            summary =
                result.responseText && result.responseText.trim().length > 0
                    ? `${result.responseText}\n\nWorkspace agent id: ${resolved.workspaceAgentId}`
                    : `Workspace @${input.nametag} completed without a text response. Workspace agent id: ${resolved.workspaceAgentId}`;
        }
    } else {
        await toolContext.agentSystem.post(workspaceCtx, { agentId: resolved.workspaceAgentId }, item);
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
            targetAgentId: resolved.workspaceAgentId,
            originAgentId: input.origin
        }
    };
}
