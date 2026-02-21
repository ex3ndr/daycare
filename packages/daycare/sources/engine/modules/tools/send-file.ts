import { promises as fs } from "node:fs";
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
import { openSecure, pathResolveSecure } from "../../../sandbox/pathResolveSecure.js";
import { agentDescriptorTargetResolve } from "../../agents/ops/agentDescriptorTargetResolve.js";

const schema = Type.Object(
    {
        path: Type.Optional(Type.String({ minLength: 1 })),
        name: Type.Optional(Type.String({ minLength: 1 })),
        mimeType: Type.Optional(Type.String({ minLength: 1 })),
        sendAs: Type.Optional(
            Type.Union([Type.Literal("auto"), Type.Literal("document"), Type.Literal("photo"), Type.Literal("video")])
        ),
        text: Type.Optional(Type.String()),
        source: Type.Optional(Type.String({ minLength: 1 })),
        channelId: Type.Optional(Type.String({ minLength: 1 }))
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
                "Send a file to the current channel via the active connector. Supports photo/video/document modes when available.",
            parameters: schema
        },
        returns: sendFileReturns,
        execute: async (args, context, toolCall) => {
            const payload = args as SendFileArgs;
            if (!context.connectorRegistry) {
                throw new Error("Connector registry unavailable");
            }

            const target = agentDescriptorTargetResolve(context.agent.descriptor);
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
        }
    };
}

async function resolveFile(payload: SendFileArgs, context: ToolExecutionContext): Promise<FileReference> {
    const hasPath = typeof payload.path === "string" && payload.path.length > 0;
    if (!hasPath) {
        throw new Error("path is required");
    }

    // Securely resolve path, following symlinks and verifying containment
    const allowedDirs = [context.permissions.workingDir, ...context.permissions.writeDirs];
    const { realPath: resolved } = await pathResolveSecure(allowedDirs, payload.path!);

    // Use lstat to check for symlinks, then open securely to prevent TOCTOU
    const stats = await fs.lstat(resolved);
    if (stats.isSymbolicLink()) {
        throw new Error("Cannot send symbolic link");
    }
    if (!stats.isFile()) {
        throw new Error("Path is not a file");
    }

    // Verify file is still accessible via secure open
    const handle = await openSecure(resolved, "r");
    const handleStats = await handle.stat();
    await handle.close();

    if (!handleStats.isFile()) {
        throw new Error("Path is not a file");
    }

    const mimeType = payload.mimeType;
    if (!mimeType) {
        throw new Error("mimeType is required when sending a path");
    }
    const name = payload.name ?? path.basename(resolved);
    const stored = await context.fileStore.saveFromPath({
        name,
        mimeType,
        path: resolved
    });
    return {
        id: stored.id,
        name: stored.name,
        mimeType: stored.mimeType,
        size: stored.size,
        path: stored.path
    };
}
