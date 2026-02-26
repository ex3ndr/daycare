import type { Context } from "@mariozechner/pi-ai";
import { messageContentExtractText } from "./messageContentExtractText.js";

export function messageExtractText(message: Context["messages"][number]): string | null {
    if (message.role !== "assistant") {
        return null;
    }
    return messageContentExtractText(message.content);
}
