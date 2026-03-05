import type { EngineEventBus } from "../../ipc/events.js";

export type AgentSyncEventType = "agent.sync.created" | "agent.sync.updated" | "agent.sync.deleted";

export type AgentSyncPayload = {
    agentId: string;
    lifecycle?: string;
    name?: string | null;
    description?: string | null;
    kind?: string;
    path?: string | null;
    connectorName?: string | null;
    foreground?: boolean;
    updatedAt?: number;
    createdAt?: number;
};

/**
 * Emits a user-scoped agent sync event to the event bus.
 * These events are consumed by SSE clients to keep the app store in sync.
 *
 * Expects: eventBus and userId are valid; payload contains at least agentId.
 */
export function agentEventEmit(
    eventBus: EngineEventBus,
    userId: string,
    type: AgentSyncEventType,
    payload: AgentSyncPayload
): void {
    eventBus.emit(type, payload, userId);
}
