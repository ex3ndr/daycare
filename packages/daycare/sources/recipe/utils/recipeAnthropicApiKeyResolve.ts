import { getOAuthApiKey } from "@mariozechner/pi-ai";

import { recipeAuthAnthropicEntryParse } from "./recipeAuthAnthropicEntryParse.js";
import { recipeAuthConfigRead } from "./recipeAuthConfigRead.js";
import { recipeAuthConfigWrite } from "./recipeAuthConfigWrite.js";

/**
 * Resolves an Anthropic API key from OAuth credentials in recipe auth config.
 * Expects: auth config contains `anthropic` entry with `type: "oauth"`.
 */
export async function recipeAnthropicApiKeyResolve(authPath: string): Promise<string> {
  const authConfig = await recipeAuthConfigRead(authPath);
  const anthropicEntry = authConfig.anthropic;
  const credentials = recipeAuthAnthropicEntryParse(anthropicEntry);
  const result = await getOAuthApiKey("anthropic", { anthropic: credentials });

  if (!result) {
    throw new Error("Failed to resolve Anthropic OAuth API key from auth.json.");
  }

  // Keep refreshed OAuth credentials persisted for the next run.
  authConfig.anthropic = { type: "oauth", ...result.newCredentials };
  await recipeAuthConfigWrite(authPath, authConfig);

  return result.apiKey;
}
