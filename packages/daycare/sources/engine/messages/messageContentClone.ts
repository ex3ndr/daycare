import type { AssistantMessage } from "@mariozechner/pi-ai";

/**
 * Clones assistant content blocks so history records are detached from runtime message objects.
 * Expects: content blocks are JSON-serializable assistant blocks.
 */
export function messageContentClone(content: AssistantMessage["content"]): AssistantMessage["content"] {
    return content.map((block) => {
        if (block.type === "toolCall") {
            return {
                ...block,
                arguments: structuredClone(block.arguments)
            };
        }
        return { ...block };
    });
}
