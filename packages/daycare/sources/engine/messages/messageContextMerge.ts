import type { MessageContext, MessageContextEnrichment } from "@/types";

/**
 * Merges two message contexts, preferring the latest scalar fields and combining enrichment tags.
 * Expects: inputs represent the same logical message stream (left older, right newer).
 */
export function messageContextMerge(left: MessageContext, right: MessageContext): MessageContext {
    const messageId = right.messageId ?? left.messageId;
    const timezone = right.timezone ?? left.timezone;
    const enrichments = messageContextEnrichmentsMerge(left.enrichments ?? [], right.enrichments ?? []);

    return {
        ...(messageId ? { messageId } : {}),
        ...(timezone ? { timezone } : {}),
        ...(enrichments.length > 0 ? { enrichments } : {})
    };
}

function messageContextEnrichmentsMerge(
    left: MessageContextEnrichment[],
    right: MessageContextEnrichment[]
): MessageContextEnrichment[] {
    const seen = new Set<string>();
    const merged: MessageContextEnrichment[] = [];
    for (const item of [...left, ...right]) {
        const key = item.key.trim();
        const value = item.value.trim();
        if (!key || !value) {
            continue;
        }
        const dedupeKey = `${key}\u0000${value}`;
        if (seen.has(dedupeKey)) {
            continue;
        }
        seen.add(dedupeKey);
        merged.push({ key, value });
    }
    return merged;
}
