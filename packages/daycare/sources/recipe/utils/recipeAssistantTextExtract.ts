import type { AssistantMessage } from "@mariozechner/pi-ai";

/**
 * Extracts concatenated text blocks from an assistant message.
 * Returns: trimmed text; empty string when no text blocks are present.
 */
export function recipeAssistantTextExtract(message: AssistantMessage): string {
    return message.content
        .filter((part): part is { type: "text"; text: string } => {
            return part.type === "text" && typeof part.text === "string";
        })
        .map((part) => part.text)
        .join("\n\n")
        .trim();
}
