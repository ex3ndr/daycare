import type { AssistantMessage } from "@mariozechner/pi-ai";

/**
 * Validates provider token usage for completed inference responses.
 * Expects: message usage reflects provider-reported output token counts.
 */
export function inferenceOutputTokensValidate(message: AssistantMessage): void {
    if (message.usage?.output === 0) {
        throw new Error("Inference error: provider returned zero output tokens.");
    }
}
