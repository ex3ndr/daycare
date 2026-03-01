import type { AgentHistoryRecord } from "@/types";
import { messageContentExtractText } from "../../../messages/messageContentExtractText.js";

/**
 * Formats agent history records into a human-readable markdown transcript.
 * When isForeground is false, labels are "System Message"/"Agent" instead of "User"/"Assistant".
 *
 * Expects: records are in chronological order from a single session.
 */
export function formatHistoryMessages(records: AgentHistoryRecord[], isForeground = true): string {
    const userLabel = isForeground ? "User" : "System Message";
    const assistantLabel = isForeground ? "Assistant" : "Agent";
    const parts: string[] = [];

    for (const record of records) {
        switch (record.type) {
            case "user_message": {
                const messageText = systemEnvelopeNormalize(record.text);
                parts.push(`## ${userLabel}\n\n${messageText}`);
                break;
            }

            case "assistant_message": {
                const assistantText = messageContentExtractText(record.content);
                if (assistantText.length > 0) {
                    parts.push(`## ${assistantLabel}\n\n${assistantText}`);
                }
                break;
            }

            case "note":
                parts.push(`> Note: ${record.text}`);
                break;

            // Skip rlm_* and assistant_rewrite records — internal implementation details
            default:
                break;
        }
    }

    return parts.join("\n\n");
}

type ParsedSystemEnvelope = {
    tag: "system_message" | "system_message_silent";
    origin: string | null;
    content: string;
};

/**
 * Rewrites transport <system_message*> envelopes so memory transcripts avoid
 * nested XML-like tags while preserving origin and inner content.
 */
function systemEnvelopeNormalize(text: string): string {
    const parsed = systemEnvelopeParse(text);
    if (!parsed) {
        return text;
    }

    const kind = parsed.tag === "system_message_silent" ? "Silent system message" : "System message";
    const originSuffix = parsed.origin ? ` (origin: ${parsed.origin})` : "";
    const content = tagsLineBreak(parsed.content);
    if (parsed.content.length === 0) {
        return `> ${kind}${originSuffix}`;
    }
    return `> ${kind}${originSuffix}\n\n${content}`;
}

function systemEnvelopeParse(text: string): ParsedSystemEnvelope | null {
    const trimmed = text.trim();
    const match = /^<(system_message(?:_silent)?)(\s[^>]*)?>([\s\S]*)<\/\1>\s*$/i.exec(trimmed);
    if (!match) {
        return null;
    }

    const tag = match[1]?.toLowerCase();
    if (tag !== "system_message" && tag !== "system_message_silent") {
        return null;
    }

    const attrs = match[2] ?? "";
    const content = (match[3] ?? "").trim();
    const originMatch = /\borigin\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
    const origin = (originMatch?.[1] ?? originMatch?.[2] ?? "").trim();

    return {
        tag,
        origin: origin.length > 0 ? origin : null,
        content
    };
}

/**
 * Inserts line breaks between adjacent XML-like tags to improve transcript readability.
 * Expects: input is plain message content; no parsing side effects.
 */
function tagsLineBreak(text: string): string {
    return text.replace(/>\s*</g, ">\n<");
}
