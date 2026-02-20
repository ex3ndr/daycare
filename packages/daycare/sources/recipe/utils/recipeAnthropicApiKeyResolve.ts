import { getOAuthApiKey } from "@mariozechner/pi-ai";

import { recipeAuthAnthropicEntryParse } from "./recipeAuthAnthropicEntryParse.js";
import { recipeAuthConfigRead } from "./recipeAuthConfigRead.js";

/**
 * Resolves an Anthropic API key from recipe auth config.
 * Expects: auth config contains `anthropic` with either `apiKey` or OAuth credentials.
 */
export async function recipeAnthropicApiKeyResolve(authPath: string): Promise<string> {
    const authConfig = await recipeAuthConfigRead(authPath);
    const anthropicEntry = authConfig.anthropic;
    if (!anthropicEntry || typeof anthropicEntry !== "object" || Array.isArray(anthropicEntry)) {
        throw new Error("Expected anthropic auth entry in auth.json.");
    }

    const apiKey = (anthropicEntry as { apiKey?: unknown }).apiKey;
    if (typeof apiKey === "string" && apiKey.length > 0) {
        return apiKey;
    }

    const credentials = recipeAuthAnthropicEntryParse(anthropicEntry);
    const result = await getOAuthApiKey("anthropic", { anthropic: credentials });

    if (!result) {
        throw new Error("Failed to resolve Anthropic OAuth API key from auth.json.");
    }

    return result.apiKey;
}
