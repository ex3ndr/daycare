/**
 * Typed SSE event definitions for app-server sync.
 * Mirrors the event types emitted by the server's EngineEventBus.
 */

export type SyncAgentPayload = {
    agentId: string;
    path?: string | null;
    kind?: string;
    name?: string | null;
    description?: string | null;
    connectorName?: string | null;
    foreground?: boolean;
    lifecycle?: string;
    createdAt?: number;
    updatedAt?: number;
};

export type SyncEventAgentCreated = {
    type: "agent.sync.created";
    payload: SyncAgentPayload;
};

export type SyncEventAgentUpdated = {
    type: "agent.sync.updated";
    payload: SyncAgentPayload;
};

export type SyncEventAgentDeleted = {
    type: "agent.sync.deleted";
    payload: { agentId: string };
};

export type SyncEventConnected = {
    type: "connected";
};

export type SyncEventConfigurationSync = {
    type: "user.configuration.sync";
    payload: {
        configuration: {
            homeReady: boolean;
            appReady: boolean;
        };
    };
};

export type SyncEvent =
    | SyncEventAgentCreated
    | SyncEventAgentUpdated
    | SyncEventAgentDeleted
    | SyncEventConnected
    | SyncEventConfigurationSync;

/**
 * Parses a raw SSE event object into a typed SyncEvent if recognized.
 * Returns null for unrecognized event types.
 */
export function syncEventParse(raw: { type: string; payload?: unknown }): SyncEvent | null {
    switch (raw.type) {
        case "connected":
            return { type: "connected" };
        case "agent.sync.created":
            return { type: "agent.sync.created", payload: raw.payload as SyncAgentPayload };
        case "agent.sync.updated":
            return { type: "agent.sync.updated", payload: raw.payload as SyncAgentPayload };
        case "agent.sync.deleted":
            return { type: "agent.sync.deleted", payload: raw.payload as { agentId: string } };
        case "user.configuration.sync":
            return {
                type: "user.configuration.sync",
                payload: raw.payload as SyncEventConfigurationSync["payload"]
            };
        default:
            return null;
    }
}
