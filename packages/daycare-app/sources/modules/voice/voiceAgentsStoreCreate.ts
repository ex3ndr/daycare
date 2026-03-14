import { create } from "zustand";
import { voiceAgentsFetch } from "./voiceAgentsFetch";
import type { VoiceAgentRecord } from "./voiceTypes";

export type VoiceAgentsStore = {
    voiceAgents: VoiceAgentRecord[];
    loading: boolean;
    error: string | null;
    fetch: (baseUrl: string, token: string, workspaceId: string | null) => Promise<void>;
};

/**
 * Creates a zustand store for workspace voice agents.
 * Expects: baseUrl/token come from authenticated app state.
 */
export function voiceAgentsStoreCreate() {
    return create<VoiceAgentsStore>((set) => ({
        voiceAgents: [],
        loading: false,
        error: null,
        fetch: async (baseUrl, token, workspaceId) => {
            set({ loading: true, error: null });
            try {
                const voiceAgents = await voiceAgentsFetch(baseUrl, token, workspaceId);
                set({ voiceAgents, loading: false });
            } catch (error) {
                set({
                    loading: false,
                    error: error instanceof Error ? error.message : "Failed to fetch voice agents"
                });
            }
        }
    }));
}
