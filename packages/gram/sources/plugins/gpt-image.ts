import type { Plugin } from "./types.js";

type GptImageConfig = {
  model?: string;
  size?: string;
  quality?: "standard" | "hd";
};

type OpenAiImageResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
};

export function createGptImagePlugin(): Plugin {
  return {
    id: "gpt-image",
    kind: "tool",
    load: async (context) => {
      context.registrar.registerImageProvider({
        id: "gpt-image",
        label: "OpenAI Images",
        generate: async (request, generationContext) => {
          const apiKey = await generationContext.secrets.get("gpt-image", "apiKey");
          if (!apiKey) {
            throw new Error("Missing gpt-image apiKey in secrets store");
          }
          const config = (context.config.config ?? {}) as GptImageConfig;
          const payload: Record<string, unknown> = {
            prompt: request.prompt,
            model: config.model ?? request.model ?? "gpt-image-1",
            size: request.size ?? config.size ?? "1024x1024",
            n: request.count ?? 1,
            response_format: "b64_json"
          };
          if (config.quality) {
            payload.quality = config.quality;
          }
          const response = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
          });
          if (!response.ok) {
            throw new Error(`OpenAI image generation failed: ${response.status}`);
          }
          const data = (await response.json()) as OpenAiImageResponse;
          const items = data.data ?? [];
          const files = [];
          for (let index = 0; index < items.length; index += 1) {
            const entry = items[index];
            if (!entry) {
              continue;
            }
            const base64 = entry.b64_json;
            if (!base64) {
              continue;
            }
            const buffer = Buffer.from(base64, "base64");
            const stored = await generationContext.fileStore.saveBuffer({
              name: `gpt-image-${Date.now()}-${index + 1}.png`,
              mimeType: "image/png",
              data: buffer,
              source: "gpt-image"
            });
            files.push({
              id: stored.id,
              name: stored.name,
              mimeType: stored.mimeType,
              size: stored.size,
              path: stored.path
            });
          }
          return { files };
        }
      });
    },
    unload: async (context) => {
      context.registrar.unregisterImageProvider("gpt-image");
    }
  };
}
