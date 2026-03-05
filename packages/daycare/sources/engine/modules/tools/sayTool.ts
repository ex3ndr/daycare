import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type {
    ConnectorFile,
    ConnectorFileMode,
    ConnectorMessageButton,
    ToolDefinition,
    ToolExecutionContext,
    ToolResultContract
} from "@/types";
import { agentPathTargetResolve } from "../../agents/ops/agentPathTargetResolve.js";
import { fileResolve } from "./fileResolve.js";

const schema = Type.Object(
    {
        text: Type.String({ minLength: 1 }),
        now: Type.Optional(Type.Boolean()),
        buttons: Type.Optional(
            Type.Array(
                Type.Union([
                    Type.Object({
                        type: Type.Literal("url"),
                        text: Type.String({ minLength: 1 }),
                        url: Type.String({ minLength: 1 })
                    }),
                    Type.Object({
                        type: Type.Literal("callback"),
                        text: Type.String({ minLength: 1 }),
                        callback: Type.String({ minLength: 1 })
                    })
                ])
            )
        ),
        files: Type.Optional(
            Type.Array(
                Type.Object({
                    path: Type.String({ minLength: 1 }),
                    mimeType: Type.String({ minLength: 1 }),
                    name: Type.Optional(Type.String({ minLength: 1 })),
                    sendAs: Type.Optional(
                        Type.Union([
                            Type.Literal("auto"),
                            Type.Literal("document"),
                            Type.Literal("photo"),
                            Type.Literal("video"),
                            Type.Literal("voice")
                        ])
                    )
                })
            )
        )
    },
    { additionalProperties: false }
);

type SayArgs = Static<typeof schema>;

type SayDeferredPayload = {
    connector: string;
    targetId: string;
    text: string;
    replyToMessageId?: string;
    buttons?: ConnectorMessageButton[];
    files?: ConnectorFile[];
};

const sayResultSchema = Type.Object(
    {
        summary: Type.String(),
        connector: Type.String(),
        targetId: Type.String()
    },
    { additionalProperties: false }
);

type SayResult = Static<typeof sayResultSchema>;

const sayReturns: ToolResultContract<SayResult> = {
    schema: sayResultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Sends user-visible text to the active foreground conversation target.
 * During Python execution, sending is deferred until script completion unless now=true.
 * Expects: caller is a foreground user agent with a resolvable connector target.
 */
export function sayTool(): ToolDefinition<typeof schema, SayResult> {
    return {
        tool: {
            name: "say",
            description: "Send user-visible text, optional buttons, and optional files to the current conversation.",
            parameters: schema
        },
        returns: sayReturns,
        visibleByDefault: (context) => context.config.foreground === true,
        execute: async (args, context, toolCall) => {
            const payload = args as SayArgs;
            const target = await agentPathTargetResolve(
                context.agentSystem.storage,
                context.ctx.userId,
                context.agent.config,
                context.agent.path
            );
            if (!target) {
                throw new Error("say is only available for foreground user agents.");
            }
            const connector = context.connectorRegistry.get(target.connector);
            if (!connector) {
                throw new Error(`Connector not loaded: ${target.connector}`);
            }
            const text = payload.text.trim();
            if (!text) {
                throw new Error("Text is required.");
            }
            const buttons = payload.buttons;
            const files = await sayFilesResolve(
                payload.files,
                context,
                target.connector,
                connector.capabilities.sendFiles?.modes
            );

            // Defer sending during Python execution unless now=true
            if (context.pythonExecution && !payload.now) {
                const summary = "Message deferred.";
                const toolMessage: ToolResultMessage = {
                    role: "toolResult",
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                    content: [{ type: "text", text: summary }],
                    isError: false,
                    timestamp: Date.now()
                };
                const deferredPayload: SayDeferredPayload = {
                    connector: target.connector,
                    targetId: target.targetId,
                    text,
                    replyToMessageId: context.messageContext.messageId,
                    buttons,
                    files
                };
                return {
                    toolMessage,
                    typedResult: {
                        summary,
                        connector: target.connector,
                        targetId: target.targetId
                    },
                    deferredPayload
                };
            }

            await connector.sendMessage(target.targetId, {
                text,
                replyToMessageId: context.messageContext.messageId,
                buttons,
                files
            });

            const summary = "Sent user-visible message.";
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
                    connector: target.connector,
                    targetId: target.targetId
                }
            };
        },
        executeDeferred: async (payload: unknown, context: ToolExecutionContext) => {
            const p = payload as SayDeferredPayload;
            const connector = context.connectorRegistry.get(p.connector);
            if (!connector) {
                throw new Error(`Connector not loaded: ${p.connector}`);
            }
            await connector.sendMessage(p.targetId, {
                text: p.text,
                replyToMessageId: p.replyToMessageId,
                buttons: p.buttons,
                files: p.files
            });
        }
    };
}

async function sayFilesResolve(
    files: SayArgs["files"],
    context: ToolExecutionContext,
    connectorName: string,
    supportedModes: ConnectorFileMode[] | undefined
): Promise<ConnectorFile[] | undefined> {
    if (!files || files.length === 0) {
        return undefined;
    }

    const modes = supportedModes ?? [];
    if (modes.length === 0) {
        throw new Error(`Connector does not support file sending: ${connectorName}`);
    }

    const resolved: ConnectorFile[] = [];
    for (const file of files) {
        const sendAs = file.sendAs;
        if (sendAs && sendAs !== "auto" && !modes.includes(sendAs)) {
            throw new Error(`Connector does not support ${sendAs} mode: ${connectorName}`);
        }
        const reference = await fileResolve(
            {
                path: file.path,
                name: file.name,
                mimeType: file.mimeType
            },
            context
        );
        resolved.push(sendAs ? { ...reference, sendAs } : reference);
    }
    return resolved;
}
