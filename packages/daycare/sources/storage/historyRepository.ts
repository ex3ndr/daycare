import type { DatabaseSync } from "node:sqlite";
import type { AgentHistoryRecord } from "@/types";
import type { DatabaseSessionHistoryRow } from "./databaseTypes.js";

/**
 * Session history repository backed by SQLite without caching.
 * Expects: schema migrations already applied for session_history.
 */
export class HistoryRepository {
    private readonly db: DatabaseSync;

    constructor(db: DatabaseSync) {
        this.db = db;
    }

    async findBySessionId(sessionId: string): Promise<AgentHistoryRecord[]> {
        const rows = this.db
            .prepare("SELECT * FROM session_history WHERE session_id = ? ORDER BY id ASC")
            .all(sessionId) as DatabaseSessionHistoryRow[];

        return rows.map((row) => historyParse(row)).filter((record): record is AgentHistoryRecord => record !== null);
    }

    async findByAgentId(agentId: string): Promise<AgentHistoryRecord[]> {
        const rows = this.db
            .prepare(
                `
              SELECT h.*
              FROM session_history h
              INNER JOIN sessions s ON s.id = h.session_id
              WHERE s.agent_id = ?
              ORDER BY s.created_at ASC, h.id ASC
            `
            )
            .all(agentId) as DatabaseSessionHistoryRow[];

        return rows.map((row) => historyParse(row)).filter((record): record is AgentHistoryRecord => record !== null);
    }

    /**
     * Appends a history record and returns the new auto-increment id.
     * Expects: sessionId references an existing session.
     */
    async append(sessionId: string, record: AgentHistoryRecord): Promise<number> {
        const { type, at, ...data } = record;
        const result = this.db
            .prepare(
                `
              INSERT INTO session_history (session_id, type, at, data)
              VALUES (?, ?, ?, ?)
            `
            )
            .run(sessionId, type, at, JSON.stringify(data));
        return Number(result.lastInsertRowid);
    }

    /**
     * Counts history records after a given id for a session.
     * Expects: afterId >= 0; returns 0 when no records exist after afterId.
     */
    async countSinceId(sessionId: string, afterId: number): Promise<number> {
        const row = this.db
            .prepare("SELECT COUNT(*) AS count FROM session_history WHERE session_id = ? AND id > ?")
            .get(sessionId, afterId) as { count: number | bigint };
        return Number(row.count);
    }

    /**
     * Returns the maximum history record id for a session.
     * Returns null when the session has no history records.
     */
    async maxId(sessionId: string): Promise<number | null> {
        const row = this.db
            .prepare("SELECT MAX(id) AS max_id FROM session_history WHERE session_id = ?")
            .get(sessionId) as { max_id: number | bigint | null };
        return row.max_id !== null ? Number(row.max_id) : null;
    }
}

function historyParse(row: DatabaseSessionHistoryRow): AgentHistoryRecord | null {
    try {
        const data = JSON.parse(row.data) as Record<string, unknown>;
        return {
            type: row.type as AgentHistoryRecord["type"],
            at: row.at,
            ...data
        } as AgentHistoryRecord;
    } catch {
        return null;
    }
}
