import type { ConnectorMessage, MessageContext } from "@/types";
import { formatTimeAI } from "../../utils/timeFormat.js";

export function messageFormatIncoming(
    message: ConnectorMessage,
    context: MessageContext,
    receivedAt: Date
): ConnectorMessage {
    if (!message.text && (!message.files || message.files.length === 0)) {
        return message;
    }
    const time = formatTimeAI(receivedAt, { timezone: context.timezone ?? "UTC" });
    const text = message.text ?? "";
    const enrichmentTags = contextEnrichmentTagsBuild(context);
    const timezoneTag = context.timezone ? `<timezone>${context.timezone}</timezone>` : "";
    const messageIdTag = context.messageId ? `<message_id>${context.messageId}</message_id>` : "";
    return {
        ...message,
        rawText: message.rawText ?? message.text,
        text: `${enrichmentTags}${timezoneTag}<time>${time}</time>${messageIdTag}<message>${text}</message>`
    };
}

function contextEnrichmentTagsBuild(context: MessageContext): string {
    const items = context.enrichments ?? [];
    if (items.length === 0) {
        return "";
    }
    return items
        .filter((item) => item.key.trim().length > 0 && item.value.trim().length > 0)
        .map((item) => `<${item.key.trim()}>${item.value.trim()}</${item.key.trim()}>`)
        .join("");
}
