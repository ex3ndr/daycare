import type { AgentHistoryRecord } from "./chatHistoryTypes";
import { chatStoreCreate } from "./chatStoreCreate";

export const useChatStore = chatStoreCreate();

type ChatSessionView = {
    history: AgentHistoryRecord[];
    loading: boolean;
    sending: boolean;
    error: string | null;
};

const CHAT_SESSION_EMPTY: ChatSessionView = {
    history: [],
    loading: false,
    sending: false,
    error: null
};

/**
 * Selects display state for a single chat session.
 * Expects: agentId is the active session key or null during initialization.
 */
export function useChat(agentId: string | null): ChatSessionView {
    return useChatStore((state) => {
        if (!agentId) {
            return CHAT_SESSION_EMPTY;
        }
        const session = state.sessions[agentId];
        if (!session) {
            return CHAT_SESSION_EMPTY;
        }
        return {
            history: session.history,
            loading: session.loading,
            sending: session.sending,
            error: session.error
        };
    });
}
