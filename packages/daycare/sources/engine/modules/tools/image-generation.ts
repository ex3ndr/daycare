import { promises as fs } from "node:fs";
import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { sanitizeFilename } from "../../../util/filename.js";
import { FileFolder } from "../../files/fileFolder.js";
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

type ImageGenerationResult = {
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
            const tempFileStore = new FileFolder(path.join(toolContext.sandbox.homeDir, "tmp", "image-generation"));

            const result = await provider.generate(
                {
                    prompt: payload.prompt,
                    size: payload.size,
                    count: payload.count,
                    model: payload.model
                },
                {
                    fileStore: tempFileStore,
                    auth: toolContext.auth,
                    logger: toolContext.logger
                }
            );

            const outputDir = path.join(toolContext.sandbox.homeDir, "downloads");
            const createdAt = new Date();
            const timestamp = createdAt.toISOString().replace(/[:.]/g, "-");
            const outputDirSandboxPath = `~/${path.relative(toolContext.sandbox.homeDir, outputDir)}`;
            const content: Array<{ type: "text"; text: string }> = [];
            const savedFiles: Array<{
                id: string;
                name: string;
                path: string;
                resolvedPath: string;
                mimeType: string;
                size: number;
            }> = [];
            for (const [index, file] of result.files.entries()) {
                if (!file.mimeType.startsWith("image/")) {
                    continue;
                }
                const suffix = result.files.length > 1 ? `-${index + 1}` : "";
                const extension = imageExtensionResolve(file.mimeType);
                const fileName = sanitizeFilename(`${timestamp}${suffix}${extension}`);
                const targetPath = path.join(outputDir, fileName);
                const sourceContent = await fs.readFile(file.path);
                const saved = await toolContext.sandbox.write({
                    path: targetPath,
                    content: sourceContent
                });
                savedFiles.push({
                    id: saved.sandboxPath,
                    name: fileName,
                    path: saved.sandboxPath,
                    resolvedPath: saved.resolvedPath,
                    mimeType: file.mimeType,
                    size: saved.bytes
                });
                content.push({
                    type: "text",
                    text: `Image file: ${saved.sandboxPath} (${file.mimeType})`
                });
            }
            const summary =
                savedFiles.length > 0
                    ? `Generated ${savedFiles.length} image(s) with ${providerId}. Saved to ${outputDirSandboxPath}: ${savedFiles.map((file) => file.path).join(", ")}.`
                    : `Generated 0 image files with ${providerId}.`;
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
                        dir: outputDirSandboxPath,
                        files: savedFiles.map((file) => ({
                            id: file.id,
                            name: file.name,
                            path: file.path,
                            resolvedPath: file.resolvedPath,
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
