import type { Context } from "@mariozechner/pi-ai";

import { promptInput } from "../commands/prompts.js";
import { recipeAnthropicApiKeyResolve } from "./utils/recipeAnthropicApiKeyResolve.js";
import { recipeAnthropicModelResolve } from "./utils/recipeAnthropicModelResolve.js";
import { recipeAnthropicReplyGet } from "./utils/recipeAnthropicReplyGet.js";
import { recipeAuthPathResolve } from "./utils/recipeAuthPathResolve.js";

const DEFAULT_MODEL = "claude-sonnet-4-5";

/**
 * Runs a dead-simple recipe loop (rlm) with Enquirer prompts and Anthropic replies.
 * Expects: Anthropic OAuth credentials available in ~/.dev/auth.json.
 */
export async function main(args: string[]): Promise<void> {
  const modelId = args[0]?.trim() || process.env.DAYCARE_RECIPE_MODEL?.trim() || DEFAULT_MODEL;
  const authPath = recipeAuthPathResolve();
  const model = recipeAnthropicModelResolve(modelId);
  const messages: Context["messages"] = [];

  console.log("Recipe rlm started.");
  console.log("Type /exit to quit.\n");

  while (true) {
    const userInput = await promptInput({
      message: "You",
      placeholder: "Type your message"
    });

    if (userInput === null) {
      break;
    }

    const text = userInput.trim();
    if (!text) {
      continue;
    }
    if (text === "/exit" || text === "/quit") {
      break;
    }

    messages.push({
      role: "user",
      content: [{ type: "text", text }],
      timestamp: Date.now()
    });

    try {
      const apiKey = await recipeAnthropicApiKeyResolve(authPath);
      const reply = await recipeAnthropicReplyGet(messages, apiKey, model);
      messages.push(reply.message);
      console.log(`\nAssistant: ${reply.text}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\nError: ${message}\n`);
    }
  }

  console.log("Exited.");
}
