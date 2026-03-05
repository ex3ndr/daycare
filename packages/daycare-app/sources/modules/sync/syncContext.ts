import { useAgentsStore } from "@/modules/agents/agentsContext";
import type { AgentListItem } from "@/modules/agents/agentsTypes";
import { syncStoreCreate } from "./syncStoreCreate";

/**
 * Singleton sync store wired to the agent store for delta dispatching.
 * On SSE events, updates agent list directly.
 * Full refetch on reconnect is handled by SyncProvider which has access to auth.
 */
export const useSyncStore = syncStoreCreate({
    onAgentCreated: (payload) => {
        useAgentsStore.getState().applyCreated(payload as AgentListItem);
    },
    onAgentUpdated: (payload) => {
        useAgentsStore.getState().applyUpdated(payload);
    },
    onAgentDeleted: (agentId) => {
        useAgentsStore.getState().applyDeleted(agentId);
    },
    onRefetch: () => {
        // Handled by SyncProvider — it watches status changes and triggers refetch with auth
    }
});
