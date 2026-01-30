import {
  complete,
  getModel,
  getModels,
  stream,
  type Api,
  type Model
} from "@mariozechner/pi-ai";

import type { Plugin } from "./types.js";

export function createAnthropicPlugin(): Plugin {
  return {
    id: "anthropic",
    kind: "inference",
    load: async (context) => {
      context.registrar.registerInferenceProvider({
        id: "anthropic",
        label: "Anthropic Claude",
        createClient: async (options) => {
          const apiKey = await options.secrets.get("anthropic", "apiKey");
          if (!apiKey) {
            throw new Error("Missing anthropic apiKey in secrets store");
          }
          const modelId = resolveModelId("anthropic", options.model);
          const model = getModel("anthropic", modelId as never);
          if (!model) {
            throw new Error(`Unknown anthropic model: ${modelId}`);
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
      context.registrar.unregisterInferenceProvider("anthropic");
    }
  };
}

function resolveModelId(provider: "anthropic", preferred?: string): string {
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
