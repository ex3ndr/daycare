import { z } from "zod";

import { definePlugin } from "../../engine/plugins/types.js";
import type { FileStore } from "../../files/store.js";

const settingsSchema = z
  .object({
    api: z.enum(["gemini", "custom"]).optional(),
    endpoint: z.string().min(1).optional(),
    baseUrl: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    size: z.string().min(1).optional(),
    apiKeyHeader: z.string().min(1).optional(),
    apiKeyPrefix: z.string().optional(),
    providerId: z.string().min(1).optional(),
    label: z.string().min(1).optional(),
    authId: z.string().min(1).optional()
  })
  .passthrough();

type NanoBananaProSettings = z.infer<typeof settingsSchema>;

type NanoBananaProResponse = {
  data?: Array<{
    b64_json?: string;
    base64?: string;
    url?: string;
    image?: string;
  }>;
  image?: string;
  image_base64?: string;
  output?: string;
};

type GeminiInlineData = {
  mimeType?: string;
  data?: string;
};

type GeminiInlineDataSnake = {
  mime_type?: string;
  data?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: GeminiInlineData;
        inline_data?: GeminiInlineDataSnake;
      }>;
    };
  }>;
};

export const plugin = definePlugin({
  settingsSchema,
  onboarding: async (api) => {
    const existingKey = await api.auth.getApiKey("google");
    if (!existingKey) {
      const apiKey = await api.prompt.input({
        message: "Google AI API key (or configure 'google' provider first)"
      });
      if (!apiKey) {
        return null;
      }
      await api.auth.setApiKey("google", apiKey);
    }

    return {
      settings: {
        api: "gemini"
      }
    };
  },
  create: (api) => {
    const settings = api.settings as NanoBananaProSettings;
    const providerId = settings.providerId ?? api.instance.pluginId;
    const label = settings.label ?? providerId;
    const apiMode = settings.api ?? (settings.endpoint ? "custom" : "gemini");
    const authId =
      settings.authId ?? (apiMode === "gemini" ? "google" : providerId);

    return {
      load: async () => {
        api.registrar.registerImageProvider({
          id: providerId,
          label,
          generate: async (request, generationContext) => {
            const apiKey = await generationContext.auth.getApiKey(authId);
            if (!apiKey) {
              throw new Error("Missing nano-banana-pro apiKey in auth store");
            }
            const count = request.count ?? 1;
            const files = [];

            if (apiMode === "gemini") {
              const model = request.model ?? settings.model ?? "gemini-3-pro-image-preview";
              const baseUrl =
                settings.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
              const endpoint =
                settings.endpoint ?? `${baseUrl}/models/${model}:generateContent`;
              const size = request.size ?? settings.size;
              const payload = buildGeminiPayload(request.prompt, size);
              for (let index = 0; index < count; index += 1) {
                const response = await fetch(endpoint, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey
                  },
                  body: JSON.stringify(payload)
                });
                if (!response.ok) {
                  throw new Error(
                    `Gemini image generation failed: ${response.status}`
                  );
                }
                const data = (await response.json()) as GeminiResponse;
                const extracted = await extractGeminiImages(
                  data,
                  generationContext.fileStore,
                  providerId
                );
                files.push(...extracted);
                if (files.length >= count) {
                  break;
                }
              }
              return { files: files.slice(0, count) };
            }

            if (!settings.endpoint) {
              throw new Error("Missing nano-banana-pro endpoint");
            }

            const headers: Record<string, string> = {
              "Content-Type": "application/json"
            };
            const headerName = settings.apiKeyHeader ?? "Authorization";
            const prefix = settings.apiKeyPrefix ?? "Bearer ";
            headers[headerName] = `${prefix}${apiKey}`;

            const payload: Record<string, unknown> = {
              prompt: request.prompt,
              model: request.model ?? settings.model,
              size: request.size ?? settings.size,
              n: count
            };

            const response = await fetch(settings.endpoint, {
              method: "POST",
              headers,
              body: JSON.stringify(payload)
            });
            if (!response.ok) {
              throw new Error(`Nano Banana Pro image generation failed: ${response.status}`);
            }
            const data = (await response.json()) as NanoBananaProResponse;
            const extracted = await extractImages(
              data,
              generationContext.fileStore,
              providerId
            );
            return { files: extracted.slice(0, count) };
          }
        });
      },
      unload: async () => {
        api.registrar.unregisterImageProvider(providerId);
      }
    };
  }
});

async function extractImages(
  data: NanoBananaProResponse,
  fileStore: FileStore,
  source: string
) {
  const files = [];
  const entries = data.data ?? [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry) {
      continue;
    }
    const base64 = entry.b64_json ?? entry.base64 ?? entry.image ?? null;
    if (base64) {
      const buffer = Buffer.from(base64, "base64");
      const stored = await fileStore.saveBuffer({
        name: `nano-banana-pro-${Date.now()}-${index + 1}.png`,
        mimeType: "image/png",
        data: buffer,
        source
      });
      files.push({
        id: stored.id,
        name: stored.name,
        mimeType: stored.mimeType,
        size: stored.size,
        path: stored.path
      });
      continue;
    }
    if (entry.url) {
      const downloaded = await fetch(entry.url);
      if (!downloaded.ok) {
        continue;
      }
      const contentType = downloaded.headers.get("content-type") ?? "image/png";
      const buffer = Buffer.from(await downloaded.arrayBuffer());
      const stored = await fileStore.saveBuffer({
        name: `nano-banana-pro-${Date.now()}-${index + 1}.png`,
        mimeType: contentType,
        data: buffer,
        source
      });
      files.push({
        id: stored.id,
        name: stored.name,
        mimeType: stored.mimeType,
        size: stored.size,
        path: stored.path
      });
    }
  }

  if (files.length === 0) {
    const single = data.image_base64 ?? data.image ?? data.output ?? null;
    if (single) {
      const buffer = Buffer.from(single, "base64");
      const stored = await fileStore.saveBuffer({
        name: `nano-banana-pro-${Date.now()}-1.png`,
        mimeType: "image/png",
        data: buffer,
        source
      });
      files.push({
        id: stored.id,
        name: stored.name,
        mimeType: stored.mimeType,
        size: stored.size,
        path: stored.path
      });
    }
  }

  return files;
}

function buildGeminiPayload(prompt: string, size?: string) {
  const payload: Record<string, unknown> = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  };
  const generationConfig: Record<string, unknown> = {
    responseModalities: ["IMAGE"]
  };
  if (size) {
    const imageConfig: Record<string, unknown> = {};
    if (size.includes(":")) {
      imageConfig.aspectRatio = size;
    } else {
      imageConfig.imageSize = size;
    }
    generationConfig.imageConfig = imageConfig;
  }
  payload.generationConfig = generationConfig;
  return payload;
}

async function extractGeminiImages(
  data: GeminiResponse,
  fileStore: FileStore,
  source: string
) {
  const files = [];
  const candidates = data.candidates ?? [];
  for (const candidate of candidates) {
    const parts = candidate.content?.parts ?? [];
    for (const part of parts) {
      const inlineData = part.inlineData;
      const inlineDataSnake = part.inline_data;
      const base64 = inlineData?.data ?? inlineDataSnake?.data ?? null;
      if (!base64) {
        continue;
      }
      const mimeType =
        inlineData?.mimeType ?? inlineDataSnake?.mime_type ?? "image/png";
      const buffer = Buffer.from(base64, "base64");
      const stored = await fileStore.saveBuffer({
        name: `nano-banana-pro-${Date.now()}-${files.length + 1}.png`,
        mimeType,
        data: buffer,
        source
      });
      files.push({
        id: stored.id,
        name: stored.name,
        mimeType: stored.mimeType,
        size: stored.size,
        path: stored.path
      });
    }
  }
  return files;
}
