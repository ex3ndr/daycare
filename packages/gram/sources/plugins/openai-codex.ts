import {
  complete,
  getModel,
  getModels,
  stream,
  type Api,
  type Model
} from "@mariozechner/pi-ai";

import type { Plugin } from "./types.js";

export function createOpenAICodexPlugin(): Plugin {
  return {
    id: "openai-codex",
    kind: "inference",
    load: async (context) => {
      context.registrar.registerInferenceProvider({
        id: "openai-codex",
        label: "OpenAI Codex",
        createClient: async (options) => {
          const apiKey = await options.secrets.get("openai-codex", "apiKey");
          if (!apiKey) {
            throw new Error("Missing openai-codex apiKey in secrets store");
          }
          const modelId = resolveModelId("openai-codex", options.model);
          const model = getModel("openai-codex", modelId as never);
          if (!model) {
            throw new Error(`Unknown openai-codex model: ${modelId}`);
          }
          return {
            modelId: model.id,
            complete: (ctx, runtimeOptions) =>
              complete(model as Model<Api>, ctx, {
                ...options.config,
                ...runtimeOptions,
                apiKey: runtimeOptions?.apiKey ?? apiKey
              }),
            stream: (ctx, runtimeOptions) =>
              stream(model as Model<Api>, ctx, {
                ...options.config,
                ...runtimeOptions,
                apiKey: runtimeOptions?.apiKey ?? apiKey
              })
          };
        }
      });
    },
    unload: async (context) => {
      context.registrar.unregisterInferenceProvider("openai-codex");
    }
  };
}

function resolveModelId(provider: "openai-codex", preferred?: string): string {
  const models = getModels(provider);
  if (models.length === 0) {
    throw new Error(`No models available for provider ${provider}`);
  }

  if (preferred) {
    const match = models.find((model) => model.id === preferred);
    if (match) {
      return match.id;
    }
  }

  const latest =
    models.find((model) => model.id.endsWith("-latest")) ??
    models.find((model) => model.id.includes("latest"));
  return latest?.id ?? models[0]!.id;
}
