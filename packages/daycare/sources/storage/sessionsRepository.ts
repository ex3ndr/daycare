import type { DatabaseSync } from "node:sqlite";
import { createId } from "@paralleldrive/cuid2";
import type { CreateSessionInput, DatabaseSessionRow, SessionDbRecord } from "./databaseTypes.js";

/**
 * Sessions repository backed by SQLite without caching.
 * Expects: schema migrations already applied for sessions.
 */
export class SessionsRepository {
    private readonly db: DatabaseSync;

    constructor(db: DatabaseSync) {
        this.db = db;
    }

    async findById(id: string): Promise<SessionDbRecord | null> {
        const row = this.db.prepare("SELECT * FROM sessions WHERE id = ? LIMIT 1").get(id) as
            | DatabaseSessionRow
            | undefined;
        if (!row) {
            return null;
        }
        return this.sessionParse(row);
    }

    async findByAgentId(agentId: string): Promise<SessionDbRecord[]> {
        const rows = this.db
            .prepare("SELECT * FROM sessions WHERE agent_id = ? ORDER BY created_at ASC")
            .all(agentId) as DatabaseSessionRow[];
        return rows.map((row) => this.sessionParse(row));
    }

    async create(input: CreateSessionInput): Promise<string> {
        const sessionId = createId();
        const createdAt = input.createdAt ?? Date.now();
        this.db
            .prepare(
                `
              INSERT INTO sessions (
                id,
                agent_id,
                inference_session_id,
                created_at,
                reset_message,
                invalidated_at,
                processed_until
              ) VALUES (?, ?, ?, ?, ?, NULL, NULL)
            `
            )
            .run(sessionId, input.agentId, input.inferenceSessionId ?? null, createdAt, input.resetMessage ?? null);
        return sessionId;
    }

    /**
     * Marks a session as ended by setting ended_at.
     * Expects: sessionId is valid.
     */
    async endSession(sessionId: string, endedAt: number): Promise<void> {
        this.db.prepare("UPDATE sessions SET ended_at = ? WHERE id = ? AND ended_at IS NULL").run(endedAt, sessionId);
    }

    /**
     * Marks a session as needing memory processing.
     * Sets invalidated_at only if null or if historyId is larger.
     * Expects: sessionId and historyId are valid.
     */
    async invalidate(sessionId: string, historyId: number): Promise<void> {
        this.db
            .prepare(
                `
              UPDATE sessions
              SET invalidated_at = ?
              WHERE id = ? AND (invalidated_at IS NULL OR invalidated_at < ?)
            `
            )
            .run(historyId, sessionId, historyId);
    }

    /**
     * Returns sessions that need memory processing, ordered by invalidated_at ASC.
     * Expects: limit > 0.
     */
    async findInvalidated(limit: number): Promise<SessionDbRecord[]> {
        const rows = this.db
            .prepare("SELECT * FROM sessions WHERE invalidated_at IS NOT NULL ORDER BY invalidated_at ASC LIMIT ?")
            .all(limit) as DatabaseSessionRow[];
        return rows.map((row) => this.sessionParse(row));
    }

    /**
     * CAS update: clears invalidated_at and sets processed_until,
     * but only if invalidated_at still matches the expected value.
     * Returns true if the update was applied.
     */
    async markProcessed(sessionId: string, processedUntil: number, expectedInvalidatedAt: number): Promise<boolean> {
        const result = this.db
            .prepare(
                `
              UPDATE sessions
              SET invalidated_at = NULL, processed_until = ?
              WHERE id = ? AND invalidated_at = ?
            `
            )
            .run(processedUntil, sessionId, expectedInvalidatedAt);
        return result.changes === 1;
    }

    private sessionParse(row: DatabaseSessionRow): SessionDbRecord {
        return {
            id: row.id,
            agentId: row.agent_id,
            inferenceSessionId: row.inference_session_id,
            createdAt: row.created_at,
            resetMessage: row.reset_message,
            invalidatedAt: row.invalidated_at ?? null,
            processedUntil: row.processed_until ?? null,
            endedAt: row.ended_at ?? null
        };
    }
}
