import type { PluginFactory } from "./manager.js";
import { createTelegramPlugin } from "./telegram.js";
import { createOpenAICodexPlugin } from "./openai-codex.js";
import { createAnthropicPlugin } from "./anthropic.js";
import { createBraveSearchPlugin } from "./brave-search.js";
import { createGptImagePlugin } from "./gpt-image.js";
import { createNanobananaPlugin } from "./nanobanana.js";

export function buildPluginCatalog(): Map<string, PluginFactory> {
  return new Map<string, PluginFactory>([
    ["telegram", createTelegramPlugin],
    ["openai-codex", createOpenAICodexPlugin],
    ["anthropic", createAnthropicPlugin],
    ["brave-search", createBraveSearchPlugin],
    ["gpt-image", createGptImagePlugin],
    ["nanobanana", createNanobananaPlugin]
  ]);
}
