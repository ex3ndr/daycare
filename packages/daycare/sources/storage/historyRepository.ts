import type { AgentHistoryRecord } from "@/types";
import type { StorageDatabase } from "./databaseOpen.js";
import type { DatabaseSessionHistoryRow } from "./databaseTypes.js";

/**
 * Session history repository backed by SQLite without caching.
 * Expects: schema migrations already applied for session_history.
 */
export class HistoryRepository {
    private readonly db: StorageDatabase;

    constructor(db: StorageDatabase) {
        this.db = db;
    }

    async findBySessionId(sessionId: string): Promise<AgentHistoryRecord[]> {
        const rows = this.db
            .prepare("SELECT * FROM session_history WHERE session_id = ? ORDER BY id ASC")
            .all(sessionId) as DatabaseSessionHistoryRow[];

        return rows.map((row) => historyParse(row)).filter((record): record is AgentHistoryRecord => record !== null);
    }

    async findByAgentId(agentId: string, limit?: number): Promise<AgentHistoryRecord[]> {
        const sql = `
              SELECT h.*
              FROM session_history h
              INNER JOIN sessions s ON s.id = h.session_id
              WHERE s.agent_id = ?
              ORDER BY s.created_at ASC, h.id ASC
              ${limit !== undefined ? `LIMIT ${limit}` : ""}
            `;
        const rows = this.db.prepare(sql).all(agentId) as DatabaseSessionHistoryRow[];

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
     * Returns history records after a given id for a session, ordered by id ASC.
     * Expects: afterId >= 0; returns empty array when no records exist after afterId.
     */
    async findSinceId(sessionId: string, afterId: number): Promise<AgentHistoryRecord[]> {
        const rows = this.db
            .prepare("SELECT * FROM session_history WHERE session_id = ? AND id > ? ORDER BY id ASC")
            .all(sessionId, afterId) as DatabaseSessionHistoryRow[];
        return rows.map((row) => historyParse(row)).filter((record): record is AgentHistoryRecord => record !== null);
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
        if (!historyRecordTypeIs(row.type)) {
            return null;
        }
        const data = JSON.parse(row.data) as Record<string, unknown>;
        return {
            type: row.type,
            at: row.at,
            ...data
        } as AgentHistoryRecord;
    } catch {
        return null;
    }
}

function historyRecordTypeIs(value: string): value is AgentHistoryRecord["type"] {
    switch (value) {
        case "user_message":
        case "assistant_message":
        case "rlm_start":
        case "rlm_tool_call":
        case "rlm_tool_result":
        case "rlm_complete":
        case "assistant_rewrite":
        case "note":
            return true;
        default:
            return false;
    }
}
