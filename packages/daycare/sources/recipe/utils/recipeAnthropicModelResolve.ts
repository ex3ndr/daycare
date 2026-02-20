import { type Api, getModel, type Model } from "@mariozechner/pi-ai";

/**
 * Resolves a typed Anthropic model from model id.
 * Expects: modelId exists in pi-ai Anthropic model catalog.
 */
export function recipeAnthropicModelResolve(modelId: string): Model<Api> {
    const model = getModel("anthropic", modelId as never);
    if (!model) {
        throw new Error(`Unknown Anthropic model: ${modelId}`);
    }
    return model as Model<Api>;
}
