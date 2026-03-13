import type { TurnsSessionState } from "./turnsStoreCreate";
import { turnsStoreCreate } from "./turnsStoreCreate";

export const useTurnsStore = turnsStoreCreate();

export type TurnsSessionView = Pick<TurnsSessionState, "turns" | "loading" | "error" | "selectedTurnId">;

const TURNS_SESSION_EMPTY: TurnsSessionView = {
    turns: [],
    loading: false,
    error: null,
    selectedTurnId: null
};

/**
 * Selects display state for a single turns session.
 * Expects: agentId is the active session key or null.
 */
export function useTurns(agentId: string | null): TurnsSessionView {
    return useTurnsStore((state) => {
        if (!agentId) return TURNS_SESSION_EMPTY;
        const session = state.sessions[agentId];
        return session ?? TURNS_SESSION_EMPTY;
    });
}
