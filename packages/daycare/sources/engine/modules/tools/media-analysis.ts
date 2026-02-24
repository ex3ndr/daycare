import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { mediaPromptDefault } from "../media-analysis/mediaPromptDefault.js";
import { mediaTypeDetect } from "../media-analysis/mediaTypeDetect.js";
import type { MediaType } from "../media-analysis/types.js";
import type { MediaAnalysisRegistry } from "../mediaAnalysisRegistry.js";

const schema = Type.Object(
    {
        path: Type.String({ minLength: 1 }),
        prompt: Type.Optional(Type.String({ minLength: 1 })),
        provider: Type.Optional(Type.String({ minLength: 1 })),
        model: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

type MediaAnalyzeArgs = Static<typeof schema>;

const mediaAnalysisResultSchema = Type.Object(
    {
        text: Type.String(),
        provider: Type.String(),
        mediaType: Type.String({ enum: ["image", "video", "audio", "pdf"] })
    },
    { additionalProperties: false }
);

type MediaAnalysisToolResult = {
    text: string;
    provider: string;
    mediaType: MediaType;
};

const mediaAnalysisReturns: ToolResultContract<MediaAnalysisToolResult> = {
    schema: mediaAnalysisResultSchema,
    toLLMText: (result) => result.text
};

/**
 * Builds the media analysis tool that routes requests to registered media providers.
 * Expects: file path points to a readable media file in sandbox scope.
 */
export function buildMediaAnalysisTool(mediaAnalysisRegistry: MediaAnalysisRegistry): ToolDefinition {
    return {
        tool: {
            name: "media_analyze",
            description: "Analyze an image, video, audio file, or PDF and return text analysis.",
            parameters: schema
        },
        returns: mediaAnalysisReturns,
        execute: async (args, context, toolCall) => {
            const payload = args as MediaAnalyzeArgs;
            const readResult = await context.sandbox.read({
                path: payload.path,
                binary: true
            });
            if (readResult.type !== "binary") {
                throw new Error("Path is not a regular file.");
            }

            const detected = mediaTypeDetect(readResult.resolvedPath);
            if (!detected) {
                throw new Error(`Unsupported media type: ${payload.path}`);
            }

            const prompt = payload.prompt ?? mediaPromptDefault(detected.mediaType);
            const provider = mediaProviderResolve(mediaAnalysisRegistry, detected.mediaType, payload.provider);

            const result = await provider.analyze(
                {
                    filePath: readResult.resolvedPath,
                    mimeType: detected.mimeType,
                    mediaType: detected.mediaType,
                    prompt,
                    model: payload.model
                },
                {
                    auth: context.auth,
                    logger: context.logger
                }
            );

            const text = result.text.trim();
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text }],
                details: {
                    path: readResult.displayPath,
                    provider: provider.id,
                    mediaType: detected.mediaType,
                    mimeType: detected.mimeType
                },
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    text,
                    provider: provider.id,
                    mediaType: detected.mediaType
                }
            };
        }
    };
}

function mediaProviderResolve(mediaAnalysisRegistry: MediaAnalysisRegistry, mediaType: MediaType, providerId?: string) {
    const providers = mediaAnalysisRegistry.list();
    if (providers.length === 0) {
        throw new Error("No media analysis providers available");
    }

    if (providerId) {
        const explicit = mediaAnalysisRegistry.get(providerId);
        if (!explicit) {
            throw new Error(`Unknown media analysis provider: ${providerId}`);
        }
        if (!explicit.supportedTypes.includes(mediaType)) {
            throw new Error(`Provider ${providerId} does not support media type: ${mediaType}`);
        }
        return explicit;
    }

    const provider = providers.length === 1 ? providers[0] : mediaAnalysisRegistry.findByMediaType(mediaType)[0];
    if (!provider) {
        throw new Error(`No media analysis provider supports media type: ${mediaType}`);
    }
    if (!provider.supportedTypes.includes(mediaType)) {
        throw new Error(`Provider ${provider.id} does not support media type: ${mediaType}`);
    }
    return provider;
}
