import type { AgentHistoryRecord } from "../chat/chatHistoryTypes";

export type AgentTurn = {
    /** Stable identity derived from the first record's timestamp. */
    id: number;
    startedAt: number;
    preview: string;
    records: AgentHistoryRecord[];
};
