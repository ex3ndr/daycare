import type { AssistantMessage } from "@mariozechner/pi-ai";

/**
 * Extracts plain assistant text by joining all text blocks in content order.
 * Expects: content blocks come from an assistant message payload.
 */
export function messageContentExtractText(content: AssistantMessage["content"]): string {
    const parts = content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .filter((text): text is string => typeof text === "string" && text.length > 0);
    return parts.join("\n");
}
