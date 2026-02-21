import type { AgentInboxItem } from "./agentTypes.js";

/**
 * Deserializes a persisted inbox item payload from durable storage.
 * Expects: payload must include a known AgentInboxItem type discriminator.
 */
export function inboxItemDeserialize(serialized: string): AgentInboxItem {
    const parsed = JSON.parse(serialized) as unknown;
    if (!recordIs(parsed)) {
        throw new Error("Invalid inbox item payload");
    }
    const type = parsed.type;
    if (
        type !== "message" &&
        type !== "system_message" &&
        type !== "signal" &&
        type !== "reset" &&
        type !== "compact" &&
        type !== "restore"
    ) {
        throw new Error(`Unknown inbox item type: ${String(type)}`);
    }
    return parsed as AgentInboxItem;
}

function recordIs(value: unknown): value is Record<string, unknown> & { type: unknown } {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return false;
    }
    return "type" in value;
}
