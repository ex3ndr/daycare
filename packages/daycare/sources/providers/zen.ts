import { type Api, complete, getModel, type Model, stream } from "@mariozechner/pi-ai";

import type { ProviderSettings } from "../settings.js";
import type { ProviderDefinition, ProviderModelInfo, ProviderOnboardingApi } from "./types.js";

const ZEN_PROVIDER_ID = "zen";
const OPENCODE_PROVIDER_ID = "opencode";
const ZEN_BASE_URL = "https://opencode.ai/zen/v1";
const ZEN_DEFAULT_MODEL_ID = "gpt-5.2-codex";

// Source: https://opencode.ai/zen/v1/models (queried 2026-02-25)
export const zenProviderModels: ProviderModelInfo[] = [
    { id: "claude-opus-4-6", name: "Claude Opus 4.6", size: "large" },
    { id: "claude-opus-4-5", name: "Claude Opus 4.5", size: "large" },
    { id: "claude-opus-4-1", name: "Claude Opus 4.1", size: "large" },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", size: "normal" },
    { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", size: "normal" },
    { id: "claude-sonnet-4", name: "Claude Sonnet 4", size: "normal" },
    { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku", size: "small" },
    { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", size: "small" },
    { id: "gemini-3.1-pro", name: "Gemini 3.1 Pro", size: "normal" },
    { id: "gemini-3-pro", name: "Gemini 3 Pro", size: "normal" },
    { id: "gemini-3-flash", name: "Gemini 3 Flash", size: "small" },
    { id: "gpt-5.3-codex", name: "GPT-5.3 Codex", size: "normal" },
    { id: "gpt-5.2", name: "GPT-5.2", size: "normal" },
    { id: "gpt-5.2-codex", name: "GPT-5.2 Codex", size: "normal" },
    { id: "gpt-5.1", name: "GPT-5.1", size: "normal" },
    { id: "gpt-5.1-codex-max", name: "GPT-5.1 Codex Max", size: "normal" },
    { id: "gpt-5.1-codex", name: "GPT-5.1 Codex", size: "normal" },
    { id: "gpt-5.1-codex-mini", name: "GPT-5.1 Codex Mini", size: "normal" },
    { id: "gpt-5", name: "GPT-5", size: "normal" },
    { id: "gpt-5-codex", name: "GPT-5 Codex", size: "normal" },
    { id: "gpt-5-nano", name: "GPT-5 Nano", size: "small" },
    { id: "glm-5", name: "GLM-5", size: "normal" },
    { id: "glm-4.7", name: "GLM-4.7", size: "normal" },
    { id: "glm-4.6", name: "GLM-4.6", size: "normal" },
    { id: "minimax-m2.5", name: "MiniMax M2.5", size: "normal" },
    { id: "minimax-m2.5-free", name: "MiniMax M2.5 Free", size: "normal" },
    { id: "minimax-m2.1", name: "MiniMax M2.1", size: "normal" },
    { id: "minimax-m2.1-free", name: "MiniMax M2.1 Free", size: "normal" },
    { id: "kimi-k2.5", name: "Kimi K2.5", size: "normal" },
    { id: "kimi-k2.5-free", name: "Kimi K2.5 Free", size: "normal" },
    { id: "kimi-k2", name: "Kimi K2", size: "normal" },
    { id: "kimi-k2-thinking", name: "Kimi K2 Thinking", size: "normal" },
    { id: "trinity-large-preview-free", name: "Trinity Large Preview Free", size: "large" },
    { id: "big-pickle", name: "Big Pickle", size: "normal" },
    { id: "glm-5-free", name: "GLM-5 Free", size: "normal" }
];

export const zenProvider: ProviderDefinition = {
    id: ZEN_PROVIDER_ID,
    name: "Zen",
    description: "OpenCode Zen inference provider.",
    auth: "apiKey",
    models: zenProviderModels,
    capabilities: {
        inference: true
    },
    onboarding: async (api) => zenProviderOnboarding(api),
    create: (context) => ({
        load: async () => {
            context.inferenceRegistry.register(context.settings.id, {
                id: context.settings.id,
                label: "Zen",
                createClient: async (options) => {
                    const modelId = zenModelIdResolve(options.model);
                    const model = zenModelResolve(modelId);
                    const apiKey = await options.auth.getApiKey(context.settings.id);
                    if (!apiKey) {
                        throw new Error("Missing zen apiKey in auth store");
                    }

                    return {
                        modelId,
                        complete: (ctx, runtimeOptions) =>
                            complete(model, ctx, zenOptionsMerge(apiKey, options.config, runtimeOptions)),
                        stream: (ctx, runtimeOptions) =>
                            stream(model, ctx, zenOptionsMerge(apiKey, options.config, runtimeOptions))
                    };
                }
            });
        },
        unload: async () => {
            context.inferenceRegistry.unregister(context.settings.id);
        }
    })
};

async function zenProviderOnboarding(api: ProviderOnboardingApi) {
    const existingApiKey = await api.auth.getApiKey(ZEN_PROVIDER_ID);
    if (!existingApiKey) {
        const apiKey = await api.prompt.input({
            message: "Zen API key"
        });
        if (apiKey === null) {
            return null;
        }
        if (!apiKey) {
            api.note("API key is required to continue.", "Zen");
            return null;
        }
        await api.auth.setApiKey(ZEN_PROVIDER_ID, apiKey);
    }

    const defaultModel = zenDefaultModelResolve();
    api.note(`Default model set to ${defaultModel.id}.`, "Zen");

    return {
        settings: {
            model: defaultModel.id
        } satisfies Partial<ProviderSettings>
    };
}

function zenModelIdResolve(preferredModel?: string): string {
    if (preferredModel) {
        const preferred = zenProviderModels.find((entry) => entry.id === preferredModel);
        if (preferred) {
            return preferred.id;
        }
    }

    const defaultModel = zenProviderModels.find((entry) => entry.id === ZEN_DEFAULT_MODEL_ID);
    if (defaultModel) {
        return defaultModel.id;
    }

    const firstModel = zenProviderModels[0];
    if (!firstModel) {
        throw new Error("No models available for provider zen");
    }

    return firstModel.id;
}

function zenModelResolve(modelId: string): Model<Api> {
    const known = getModel(OPENCODE_PROVIDER_ID as never, modelId as never);
    if (known) {
        return known as Model<Api>;
    }

    const modelInfo = zenProviderModels.find((entry) => entry.id === modelId);
    return {
        id: modelId,
        name: modelInfo?.name ?? modelId,
        api: "openai-responses",
        provider: OPENCODE_PROVIDER_ID,
        baseUrl: ZEN_BASE_URL,
        reasoning: true,
        input: ["text", "image"],
        cost: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0
        },
        contextWindow: 400000,
        maxTokens: 128000
    };
}

function zenDefaultModelResolve(): ProviderModelInfo {
    const model = zenProviderModels.find((entry) => entry.id === ZEN_DEFAULT_MODEL_ID) ?? zenProviderModels[0];
    if (!model) {
        throw new Error("No models available for provider zen");
    }
    return model;
}

function zenOptionsMerge(
    apiKey: string,
    config?: Record<string, unknown>,
    runtimeOptions?: Record<string, unknown>
): Record<string, unknown> {
    const merged = {
        ...(config ?? {}),
        ...(runtimeOptions ?? {})
    };
    merged.apiKey = (runtimeOptions as { apiKey?: string } | undefined)?.apiKey ?? apiKey;
    return merged;
}
