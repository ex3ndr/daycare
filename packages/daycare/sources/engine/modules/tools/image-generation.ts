import { Type } from "@sinclair/typebox";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";

import type { ImageGenerationRegistry } from "../imageGenerationRegistry.js";
import type { ImageGenerationRequest } from "../images/types.js";
import type { ToolDefinition, ToolResultContract } from "@/types";

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
    workspaceDir: Type.String()
  },
  { additionalProperties: false }
);

type ImageGenerationResult = {
  summary: string;
  provider: string;
  fileCount: number;
  workspaceDir: string;
};

const imageGenerationReturns: ToolResultContract<ImageGenerationResult> = {
  schema: imageGenerationResultSchema,
  toLLMText: (result) => result.summary
};

export function buildImageGenerationTool(
  imageRegistry: ImageGenerationRegistry
): ToolDefinition {
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
      const providerId =
        payload.provider ??
        (providers.length === 1 ? providers[0]!.id : null);
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

      const workspaceDir = toolContext.permissions.workingDir;
      const workspaceFilesDir = path.join(workspaceDir, "files");
      await fs.mkdir(workspaceFilesDir, { recursive: true });
      const createdAt = new Date();
      const timestamp = createdAt.toISOString().replace(/[:.]/g, "-");

      const summary = `Generated ${result.files.length} image(s) with ${providerId}. Saved under ${workspaceFilesDir}.`;
      const content: Array<{ type: "text"; text: string }> = [
        {
          type: "text",
          text: summary
        }
      ];
      const workspaceFiles: Array<{ name: string; path: string; mimeType: string }> = [];
      for (const [index, file] of result.files.entries()) {
        if (!file.mimeType.startsWith("image/")) {
          continue;
        }
        const suffix = result.files.length > 1 ? `-${index + 1}` : "";
        const filename = `${timestamp}${suffix}.png`;
        const outputPath = path.join(workspaceFilesDir, filename);
        await fs.copyFile(file.path, outputPath);
        workspaceFiles.push({ name: filename, path: outputPath, mimeType: file.mimeType });
        content.push({
          type: "text",
          text: `Image file: ${outputPath} (${file.mimeType})`
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
          workspace: {
            dir: workspaceFilesDir,
            files: workspaceFiles
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
          fileCount: workspaceFiles.length,
          workspaceDir: workspaceFilesDir
        }
      };
    }
  };
}
