import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import type { ImageGenerationRegistry } from "../imageGenerationRegistry.js";
import type { ImageGenerationRequest } from "../images/types.js";

const schema = Type.Object(
    {
        prompt: Type.String({ minLength: 1 }),
        provider: Type.Optional(Type.String({ minLength: 1 })),
        size: Type.Optional(Type.String({ minLength: 1 })),
        count: Type.Optional(Type.Number({ minimum: 1, maximum: 4 })),
        model: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

const imageGenerationResultSchema = Type.Object(
    {
        summary: Type.String(),
        provider: Type.String(),
        fileCount: Type.Number(),
        downloadsDir: Type.String()
    },
    { additionalProperties: false }
);

type ImageGenerationResult = {
    summary: string;
    provider: string;
    fileCount: number;
    downloadsDir: string;
};

const imageGenerationReturns: ToolResultContract<ImageGenerationResult> = {
    schema: imageGenerationResultSchema,
    toLLMText: (result) => result.summary
};

const imageExtensionByMimeType: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff",
    "image/avif": ".avif",
    "image/x-icon": ".ico",
    "image/vnd.microsoft.icon": ".ico"
};

function imageExtensionResolve(mimeType: string): string {
    const normalized = mimeType.trim().toLowerCase();
    if (normalized.length === 0) {
        return ".bin";
    }
    const mapped = imageExtensionByMimeType[normalized];
    if (mapped) {
        return mapped;
    }
    if (!normalized.startsWith("image/")) {
        return ".bin";
    }
    const subtype = normalized.slice("image/".length).split(";")[0]?.trim() ?? "";
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

export function buildImageGenerationTool(imageRegistry: ImageGenerationRegistry): ToolDefinition {
    return {
        tool: {
            name: "generate_image",
            description: "Generate one or more images using the configured image provider.",
            parameters: schema
        },
        returns: imageGenerationReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as ImageGenerationRequest & { provider?: string };
            const providers = imageRegistry.list();
            if (providers.length === 0) {
                throw new Error("No image generation providers available");
            }
            const providerId = payload.provider ?? (providers.length === 1 ? providers[0]!.id : null);
            if (!providerId) {
                throw new Error("Multiple image providers available; specify provider");
            }
            const provider = imageRegistry.get(providerId);
            if (!provider) {
                throw new Error(`Unknown image provider: ${providerId}`);
            }

            const result = await provider.generate(
                {
                    prompt: payload.prompt,
                    size: payload.size,
                    count: payload.count,
                    model: payload.model
                },
                {
                    fileStore: toolContext.fileStore,
                    auth: toolContext.auth,
                    logger: toolContext.logger
                }
            );

            const downloadsDir = toolContext.fileStore.path;
            const createdAt = new Date();
            const timestamp = createdAt.toISOString().replace(/[:.]/g, "-");

            const summary = `Generated ${result.files.length} image(s) with ${providerId}. Saved under ${downloadsDir}.`;
            const content: Array<{ type: "text"; text: string }> = [
                {
                    type: "text",
                    text: summary
                }
            ];
            const savedFiles: Array<{ id: string; name: string; path: string; mimeType: string; size: number }> = [];
            for (const [index, file] of result.files.entries()) {
                if (!file.mimeType.startsWith("image/")) {
                    continue;
                }
                const suffix = result.files.length > 1 ? `-${index + 1}` : "";
                const extension = imageExtensionResolve(file.mimeType);
                const saved = await toolContext.fileStore.saveFromPath({
                    name: `${timestamp}${suffix}${extension}`,
                    mimeType: file.mimeType,
                    path: file.path
                });
                savedFiles.push(saved);
                content.push({
                    type: "text",
                    text: `Image file: ${saved.path} (${file.mimeType})`
                });
            }

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
                        dir: downloadsDir,
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
                    downloadsDir
                }
            };
        }
    };
}
