import { create } from "zustand";
import { turnsFetch } from "./turnsApi";
import type { AgentTurn } from "./turnTypes";

export type TurnsSessionState = {
    agentId: string;
    turns: AgentTurn[];
    loading: boolean;
    error: string | null;
    selectedTurnId: number | null;
};

export type TurnsStore = {
    sessions: Record<string, TurnsSessionState>;
    open: (baseUrl: string, token: string, workspaceId: string | null, agentId: string) => Promise<void>;
    poll: (baseUrl: string, token: string, workspaceId: string | null, agentId: string) => Promise<void>;
    selectTurn: (agentId: string, turnId: number | null) => void;
};

function turnsSessionDefault(agentId: string): TurnsSessionState {
    return {
        agentId,
        turns: [],
        loading: false,
        error: null,
        selectedTurnId: null
    };
}

/**
 * Creates a global turns store keyed by agent id.
 * Expects: baseUrl/token are authenticated values from auth state.
 */
export function turnsStoreCreate() {
    return create<TurnsStore>((set, get) => ({
        sessions: {},
        open: async (baseUrl, token, workspaceId, agentId) => {
            const existing = get().sessions[agentId] ?? turnsSessionDefault(agentId);
            set({
                sessions: {
                    ...get().sessions,
                    [agentId]: { ...existing, loading: true, error: null }
                }
            });
            try {
                const turns = await turnsFetch(baseUrl, token, workspaceId, agentId);
                set({
                    sessions: {
                        ...get().sessions,
                        [agentId]: {
                            ...turnsSessionDefault(agentId),
                            turns,
                            selectedTurnId: turns.length > 0 ? turns[turns.length - 1]!.id : null
                        }
                    }
                });
            } catch (error) {
                set({
                    sessions: {
                        ...get().sessions,
                        [agentId]: {
                            ...existing,
                            loading: false,
                            error: error instanceof Error ? error.message : "Failed to load turns"
                        }
                    }
                });
            }
        },
        poll: async (baseUrl, token, workspaceId, agentId) => {
            const existing = get().sessions[agentId];
            if (!existing) return;
            try {
                const turns = await turnsFetch(baseUrl, token, workspaceId, agentId);
                const prevSelected = existing.selectedTurnId;
                set({
                    sessions: {
                        ...get().sessions,
                        [agentId]: {
                            ...existing,
                            turns,
                            error: null,
                            selectedTurnId: prevSelected
                        }
                    }
                });
            } catch {
                // Silently ignore poll errors
            }
        },
        selectTurn: (agentId, turnId) => {
            const existing = get().sessions[agentId];
            if (!existing) return;
            set({
                sessions: {
                    ...get().sessions,
                    [agentId]: { ...existing, selectedTurnId: turnId }
                }
            });
        }
    }));
}
