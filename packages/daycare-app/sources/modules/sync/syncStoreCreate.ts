import { create } from "zustand";
import type { AgentListItem } from "@/modules/agents/agentsTypes";
import type { SseClient } from "./sseClientCreate";
import { sseClientCreate } from "./sseClientCreate";
import { BACKOFF_INITIAL_MS, syncBackoffCompute } from "./syncBackoff";
import type { SyncEvent } from "./syncEventTypes";
import { syncEventParse } from "./syncEventTypes";

export type SyncStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

export type SyncStoreCallbacks = {
    onAgentCreated: (payload: Partial<AgentListItem> & { agentId: string }) => void;
    onAgentUpdated: (payload: { agentId: string; updatedAt?: number } & Partial<AgentListItem>) => void;
    onAgentDeleted: (agentId: string) => void;
    onRefetch: () => void;
};

export type SyncStore = {
    status: SyncStatus;
    lastConnectedAt: number | null;
    connect: (baseUrl: string, token: string) => void;
    disconnect: () => void;
};

const KEEPALIVE_TIMEOUT_MS = 60_000;

/**
 * Creates a zustand store that manages an SSE connection for real-time sync.
 * Handles reconnection with exponential backoff and dispatches events to domain stores.
 *
 * Expects: callbacks wire sync events to domain-specific stores.
 */
export function syncStoreCreate(callbacks: SyncStoreCallbacks) {
    return create<SyncStore>((set, get) => {
        let client: SseClient | null = null;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let keepaliveTimer: ReturnType<typeof setTimeout> | null = null;
        let backoffMs = BACKOFF_INITIAL_MS;
        let currentBaseUrl = "";
        let currentToken = "";

        function resetKeepaliveTimer() {
            if (keepaliveTimer) {
                clearTimeout(keepaliveTimer);
            }
            keepaliveTimer = setTimeout(() => {
                // No data received within timeout — force reconnect
                if (get().status === "connected") {
                    scheduleReconnect();
                }
            }, KEEPALIVE_TIMEOUT_MS);
        }

        function clearTimers() {
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            if (keepaliveTimer) {
                clearTimeout(keepaliveTimer);
                keepaliveTimer = null;
            }
        }

        function handleEvent(raw: { type: string; payload?: unknown }) {
            resetKeepaliveTimer();
            const event = syncEventParse(raw);
            if (!event) {
                return;
            }
            dispatchSyncEvent(event);
        }

        function dispatchSyncEvent(event: SyncEvent) {
            switch (event.type) {
                case "connected":
                    backoffMs = BACKOFF_INITIAL_MS;
                    set({ status: "connected", lastConnectedAt: Date.now() });
                    callbacks.onRefetch();
                    break;
                case "agent.sync.created":
                    callbacks.onAgentCreated(event.payload as Partial<AgentListItem> & { agentId: string });
                    break;
                case "agent.sync.updated":
                    callbacks.onAgentUpdated(
                        event.payload as { agentId: string; updatedAt?: number } & Partial<AgentListItem>
                    );
                    break;
                case "agent.sync.deleted":
                    callbacks.onAgentDeleted(event.payload.agentId);
                    break;
            }
        }

        function scheduleReconnect() {
            if (client) {
                client.close();
                client = null;
            }
            set({ status: "reconnecting" });
            const [delay, nextBackoff] = syncBackoffCompute(backoffMs);
            backoffMs = nextBackoff;
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                doConnect(currentBaseUrl, currentToken);
            }, delay);
        }

        function doConnect(baseUrl: string, token: string) {
            if (client) {
                client.close();
            }
            set({ status: "connecting" });
            client = sseClientCreate({
                baseUrl,
                token,
                onEvent: handleEvent,
                onStatus: (status) => {
                    if (status === "disconnected" || status === "error") {
                        scheduleReconnect();
                    }
                }
            });
            resetKeepaliveTimer();
        }

        return {
            status: "disconnected",
            lastConnectedAt: null,
            connect: (baseUrl, token) => {
                currentBaseUrl = baseUrl;
                currentToken = token;
                clearTimers();
                backoffMs = BACKOFF_INITIAL_MS;
                doConnect(baseUrl, token);
            },
            disconnect: () => {
                clearTimers();
                if (client) {
                    client.close();
                    client = null;
                }
                set({ status: "disconnected" });
            }
        };
    });
}
