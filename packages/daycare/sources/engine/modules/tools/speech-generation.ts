import { promises as fs } from "node:fs";
import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { sanitizeFilename } from "../../../utils/filename.js";
import { FileFolder } from "../../files/fileFolder.js";
import type { SpeechGenerationRequest } from "../speech/types.js";
import type { SpeechGenerationRegistry } from "../speechGenerationRegistry.js";

const schema = Type.Object(
    {
        text: Type.String({ minLength: 1 }),
        provider: Type.Optional(Type.String({ minLength: 1 })),
        model: Type.Optional(Type.String({ minLength: 1 })),
        voice: Type.Optional(Type.String({ minLength: 1 })),
        speed: Type.Optional(Type.Number({ minimum: 0.25, maximum: 4.0 })),
        language: Type.Optional(Type.String({ minLength: 1 })),
        output_format: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

const speechGenerationResultSchema = Type.Object(
    {
        summary: Type.String(),
        provider: Type.String(),
        fileCount: Type.Number(),
        generated: Type.Array(
            Type.Object(
                {
                    name: Type.String(),
                    path: Type.String(),
                    mimeType: Type.String(),
                    size: Type.Number()
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
);

type SpeechGenerationResult = {
    summary: string;
    provider: string;
    fileCount: number;
    generated: Array<{
        name: string;
        path: string;
        mimeType: string;
        size: number;
    }>;
};

const speechGenerationReturns: ToolResultContract<SpeechGenerationResult> = {
    schema: speechGenerationResultSchema,
    toLLMText: (result) => result.summary
};

const audioExtensionByMimeType: Record<string, string> = {
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/wave": ".wav",
    "audio/ogg": ".ogg",
    "audio/flac": ".flac",
    "audio/aac": ".aac",
    "audio/opus": ".opus",
    "audio/webm": ".webm",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a"
};

function audioExtensionResolve(mimeType: string): string {
    const normalized = mimeType.trim().toLowerCase();
    if (normalized.length === 0) {
        return ".bin";
    }
    const mapped = audioExtensionByMimeType[normalized];
    if (mapped) {
        return mapped;
    }
    if (!normalized.startsWith("audio/")) {
        return ".bin";
    }
    const subtype = normalized.slice("audio/".length).split(";")[0]?.trim() ?? "";
    const baseSubtype = subtype.split("+")[0]?.trim() ?? "";
    if (baseSubtype.length === 0) {
        return ".bin";
    }
    const safeSubtype = baseSubtype.replace(/[^a-z0-9.-]/g, "");
    if (safeSubtype.length === 0) {
        return ".bin";
    }
    return safeSubtype.startsWith("x-") ? `.${safeSubtype.slice(2)}` : `.${safeSubtype}`;
}

export function buildSpeechGenerationTool(speechRegistry: SpeechGenerationRegistry): ToolDefinition {
    return {
        tool: {
            name: "generate_speech",
            description: "Generate speech audio from text using the configured speech provider.",
            parameters: schema
        },
        returns: speechGenerationReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as SpeechGenerationRequest & { provider?: string; output_format?: string };
            const providers = speechRegistry.list();
            if (providers.length === 0) {
                throw new Error("No speech generation providers available");
            }
            const providerId = payload.provider ?? (providers.length === 1 ? providers[0]!.id : null);
            if (!providerId) {
                throw new Error("Multiple speech providers available; specify provider");
            }
            const provider = speechRegistry.get(providerId);
            if (!provider) {
                throw new Error(`Unknown speech provider: ${providerId}`);
            }
            const tempFileStore = new FileFolder(path.join(toolContext.sandbox.homeDir, "tmp", "speech-generation"));

            const result = await provider.generate(
                {
                    text: payload.text,
                    model: payload.model,
                    voice: payload.voice,
                    speed: payload.speed,
                    language: payload.language,
                    outputFormat: payload.output_format
                },
                {
                    fileStore: tempFileStore,
                    auth: toolContext.auth,
                    logger: toolContext.logger
                }
            );

            const createdAt = new Date();
            const timestamp = createdAt.toISOString().replace(/[:.]/g, "-");
            const content: Array<{ type: "text"; text: string }> = [];
            const savedFiles: Array<{
                id: string;
                name: string;
                path: string;
                mimeType: string;
                size: number;
            }> = [];
            for (const [index, file] of result.files.entries()) {
                if (!file.mimeType.startsWith("audio/")) {
                    continue;
                }
                const suffix = result.files.length > 1 ? `-${index + 1}` : "";
                const extension = audioExtensionResolve(file.mimeType);
                const fileName = sanitizeFilename(`${timestamp}${suffix}${extension}`);
                const sourceContent = await fs.readFile(file.path);
                const saved = await toolContext.sandbox.write({
                    path: `~/downloads/${fileName}`,
                    content: sourceContent
                });
                savedFiles.push({
                    id: saved.sandboxPath,
                    name: fileName,
                    path: saved.sandboxPath,
                    mimeType: file.mimeType,
                    size: saved.bytes
                });
                content.push({
                    type: "text",
                    text: `Audio file: ${saved.sandboxPath} (${file.mimeType})`
                });
            }
            const summary =
                savedFiles.length > 0
                    ? `Generated ${savedFiles.length} audio file(s) with ${providerId}. Saved to ~/downloads: ${savedFiles.map((file) => file.path).join(", ")}.`
                    : `Generated 0 audio files with ${providerId}.`;
            content.unshift({
                type: "text",
                text: summary
            });

            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content,
                details: {
                    provider: providerId,
                    files: result.files.map((file) => ({
                        id: file.id,
                        name: file.name,
                        mimeType: file.mimeType,
                        size: file.size
                    })),
                    downloads: {
                        dir: "~/downloads",
                        files: savedFiles.map((file) => ({
                            id: file.id,
                            name: file.name,
                            path: file.path,
                            mimeType: file.mimeType,
                            size: file.size
                        }))
                    }
                },
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    provider: providerId,
                    fileCount: savedFiles.length,
                    generated: savedFiles.map((file) => ({
                        name: file.name,
                        path: file.path,
                        mimeType: file.mimeType,
                        size: file.size
                    }))
                }
            };
        }
    };
}
