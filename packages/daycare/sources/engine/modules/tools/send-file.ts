import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

import type {
    ConnectorFileDisposition,
    FileReference,
    ToolDefinition,
    ToolExecutionContext,
    ToolResultContract
} from "@/types";
import { sanitizeFilename } from "../../../util/filename.js";
import { agentPathTargetResolve } from "../../agents/ops/agentPathTargetResolve.js";

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
    targetId: string;
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

            const target = await agentPathTargetResolve(
                context.agentSystem.storage,
                context.ctx.userId,
                context.agent.config,
                context.agent.path
            );
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

            const file = await resolveFile(payload, context);
            const messageText = typeof payload.text === "string" && payload.text.length > 0 ? payload.text : null;

            const targetId = payload.channelId ?? target?.targetId;
            if (!targetId) {
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
                    targetId,
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

            await connector.sendMessage(targetId, {
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
            await connector.sendMessage(p.targetId, {
                text: p.text,
                files: [{ ...p.file, sendAs: p.sendAs }]
            });
        }
    };
}

async function resolveFile(payload: SendFileArgs, context: ToolExecutionContext): Promise<FileReference> {
    if (!payload.path || payload.path.length === 0) {
        throw new Error("path is required");
    }
    if (!payload.mimeType) {
        throw new Error("mimeType is required when sending a path");
    }

    const readResult = await context.sandbox.read({ path: payload.path, binary: true });
    if (readResult.type !== "binary") {
        throw new Error("Path is not a file");
    }

    const name = sanitizeFilename(payload.name ?? path.basename(readResult.displayPath));
    const stored = await context.sandbox.write({
        path: `~/downloads/${name}`,
        content: readResult.content
    });
    return {
        id: stored.sandboxPath,
        name,
        mimeType: payload.mimeType,
        size: stored.bytes,
        path: stored.resolvedPath
    };
}
