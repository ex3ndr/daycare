import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

import type {
    ConnectorFileDisposition,
    ConnectorRecipient,
    FileReference,
    ToolDefinition,
    ToolExecutionContext,
    ToolResultContract
} from "@/types";
import { userConnectorKeyCreate } from "../../../storage/userConnectorKeyCreate.js";
import { agentPathTargetResolve } from "../../agents/ops/agentPathTargetResolve.js";
import { fileResolve } from "./fileResolve.js";

const schema = Type.Object(
    {
        path: Type.Optional(Type.String({ minLength: 1 })),
        name: Type.Optional(Type.String({ minLength: 1 })),
        mimeType: Type.Optional(Type.String({ minLength: 1 })),
        sendAs: Type.Optional(
            Type.Union([
                Type.Literal("auto"),
                Type.Literal("document"),
                Type.Literal("photo"),
                Type.Literal("video"),
                Type.Literal("voice")
            ])
        ),
        text: Type.Optional(Type.String()),
        source: Type.Optional(Type.String({ minLength: 1 })),
        channelId: Type.Optional(Type.String({ minLength: 1 })),
        now: Type.Optional(Type.Boolean())
    },
    { additionalProperties: false }
);

type SendFileArgs = {
    path?: string;
    name?: string;
    mimeType?: string;
    sendAs?: ConnectorFileDisposition;
    text?: string;
    source?: string;
    channelId?: string;
    now?: boolean;
};

type SendFileDeferredPayload = {
    source: string;
    recipient: ConnectorRecipient;
    text: string | null;
    file: FileReference;
    sendAs: ConnectorFileDisposition | "auto";
};

const sendFileResultSchema = Type.Object(
    {
        summary: Type.String(),
        fileId: Type.String(),
        fileName: Type.String(),
        mimeType: Type.String(),
        size: Type.Number(),
        sendAs: Type.String()
    },
    { additionalProperties: false }
);

type SendFileResult = {
    summary: string;
    fileId: string;
    fileName: string;
    mimeType: string;
    size: number;
    sendAs: string;
};

const sendFileReturns: ToolResultContract<SendFileResult> = {
    schema: sendFileResultSchema,
    toLLMText: (result) => result.summary
};

export function buildSendFileTool(): ToolDefinition<typeof schema> {
    return {
        tool: {
            name: "send_file",
            description:
                "Send a file to the current channel via the active connector. Supports photo/video/document/voice modes when available.",
            parameters: schema
        },
        returns: sendFileReturns,
        execute: async (args, context, toolCall) => {
            const payload = args as SendFileArgs;
            if (!context.connectorRegistry) {
                throw new Error("Connector registry unavailable");
            }

            let target = await agentPathTargetResolve(
                context.agentSystem.storage,
                context.ctx.userId,
                context.agent.config,
                context.agent.path
            );
            if (!target) {
                target = await foregroundTargetResolve(context);
            }
            if (payload.source && target && payload.source !== target.connector && !payload.channelId) {
                throw new Error("Override source requires an explicit channelId.");
            }
            const source = payload.source ?? target?.connector ?? context.source;
            const connector = context.connectorRegistry.get(source);
            if (!connector) {
                throw new Error(`Connector not loaded: ${source}`);
            }

            const modes = connector.capabilities.sendFiles?.modes ?? [];
            if (modes.length === 0) {
                throw new Error(`Connector does not support file sending: ${source}`);
            }

            const sendAs = payload.sendAs ?? "auto";
            if (sendAs !== "auto" && !modes.includes(sendAs)) {
                throw new Error(`Connector does not support ${sendAs} mode: ${source}`);
            }

            const file = await fileResolve(
                {
                    path: payload.path ?? "",
                    name: payload.name,
                    mimeType: payload.mimeType ?? ""
                },
                context
            );
            const messageText = typeof payload.text === "string" && payload.text.length > 0 ? payload.text : null;

            const recipient =
                payload.channelId && source
                    ? { connectorKey: userConnectorKeyCreate(source, payload.channelId) }
                    : target?.recipient;
            if (!recipient) {
                throw new Error("Send file requires a user agent or explicit channelId.");
            }

            // Defer sending during Python execution unless now=true
            if (context.pythonExecution && !payload.now) {
                const summary = `File ${file.name} deferred.`;
                const toolMessage: ToolResultMessage = {
                    role: "toolResult",
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                    content: [{ type: "text", text: summary }],
                    isError: false,
                    timestamp: Date.now()
                };
                const deferredPayload: SendFileDeferredPayload = {
                    source,
                    recipient,
                    text: messageText,
                    file,
                    sendAs
                };
                return {
                    toolMessage,
                    typedResult: {
                        summary,
                        fileId: file.id,
                        fileName: file.name,
                        mimeType: file.mimeType,
                        size: file.size,
                        sendAs
                    },
                    deferredPayload
                };
            }

            await connector.sendMessage(recipient, {
                text: messageText,
                files: [{ ...file, sendAs }]
            });

            const summary = `Sent file ${file.name}.`;
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
                details: {
                    fileId: file.id,
                    name: file.name,
                    mimeType: file.mimeType,
                    sendAs
                },
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    fileId: file.id,
                    fileName: file.name,
                    mimeType: file.mimeType,
                    size: file.size,
                    sendAs
                }
            };
        },
        executeDeferred: async (payload: unknown, context: ToolExecutionContext) => {
            const p = payload as SendFileDeferredPayload;
            const connector = context.connectorRegistry.get(p.source);
            if (!connector) {
                throw new Error(`Connector not loaded: ${p.source}`);
            }
            await connector.sendMessage(p.recipient, {
                text: p.text,
                files: [{ ...p.file, sendAs: p.sendAs }]
            });
        }
    };
}

async function foregroundTargetResolve(context: ToolExecutionContext): Promise<{
    connector: string;
    targetId: string;
    recipient: ConnectorRecipient;
} | null> {
    const foregroundAgentId = context.agentSystem.agentFor(context.ctx, "most-recent-foreground");
    if (!foregroundAgentId) {
        return null;
    }
    const foregroundAgent = await context.agentSystem.storage.agents.findById(foregroundAgentId);
    if (!foregroundAgent) {
        return null;
    }
    return agentPathTargetResolve(
        context.agentSystem.storage,
        context.ctx.userId,
        { connectorName: foregroundAgent.connectorName },
        foregroundAgent.path
    );
}
