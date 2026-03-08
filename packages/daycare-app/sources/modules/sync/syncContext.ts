import { useAgentsStore } from "@/modules/agents/agentsContext";
import type { AgentListItem } from "@/modules/agents/agentsTypes";
import { useConfigStore } from "@/modules/config/configContext";
import { syncStoreCreate } from "./syncStoreCreate";

/**
 * Singleton sync store wired to the agent and config stores for delta dispatching.
 * On SSE events, updates agent list and workspace config directly.
 * Full refetch on reconnect is handled by WorkspaceSync which has access to auth and workspace scope.
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
    onConfigurationSync: (configuration) => {
        useConfigStore.getState().applySync(configuration);
    },
    onRefetch: () => {
        // Handled by WorkspaceSync — it watches status changes and triggers refetch with auth
    }
});
