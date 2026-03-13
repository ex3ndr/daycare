import type { AgentHistoryRecord } from "../chat/chatHistoryTypes";

export type AgentTurn = {
    index: number;
    startedAt: number;
    preview: string;
    records: AgentHistoryRecord[];
};
