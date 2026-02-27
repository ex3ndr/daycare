import type { ConnectorMessage } from "@/types";

/**
 * Checks whether a connector message has no meaningful text and no files.
 * Expects: connector payload from a plugin before agent formatting.
 */
export function messageIsEmpty(message: ConnectorMessage): boolean {
    const text = (message.text ?? "").trim();
    const rawText = (message.rawText ?? "").trim();
    const hasFiles = (message.files?.length ?? 0) > 0;
    return text.length === 0 && rawText.length === 0 && !hasFiles;
}
