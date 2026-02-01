import type { Context } from "@mariozechner/pi-ai";

export function messageExtractText(
  message: Context["messages"][number]
): string | null {
  if (message.role !== "assistant") {
    return null;
  }
  const parts = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .filter((text): text is string => typeof text === "string" && text.length > 0);
  return parts.join("\n");
}
