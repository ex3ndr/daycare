import type { AgentInboxItem } from "./agentTypes.js";

/**
 * Serializes an inbox item for durable storage.
 * Expects: item is a valid AgentInboxItem payload.
 */
export function inboxItemSerialize(item: AgentInboxItem): string {
    return JSON.stringify(item);
}
