import {
  complete,
  type Api,
  type AssistantMessage,
  type Context,
  type Model
} from "@mariozechner/pi-ai";

import { recipeAssistantTextExtract } from "./recipeAssistantTextExtract.js";

export type RecipeAnthropicReply = {
  text: string;
  message: AssistantMessage;
};

/**
 * Calls Anthropic with current recipe messages and returns assistant text + message.
 * Expects: messages contain valid chat turns and apiKey is authorized.
 */
export async function recipeAnthropicReplyGet(
  messages: Context["messages"],
  apiKey: string,
  model: Model<Api>
): Promise<RecipeAnthropicReply> {
  const response = await complete(model, { messages, tools: [] }, {
    apiKey,
    sessionId: "recipe-rlm"
  });

  if (response.stopReason === "error" || response.stopReason === "aborted") {
    throw new Error(response.errorMessage ?? `Inference failed with stopReason=${response.stopReason}`);
  }

  const text = recipeAssistantTextExtract(response);
  if (!text) {
    throw new Error("Anthropic response did not include text content.");
  }

  return { text, message: response };
}
