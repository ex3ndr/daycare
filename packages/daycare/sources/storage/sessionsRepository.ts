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
                reset_message
              ) VALUES (?, ?, ?, ?, ?)
            `
            )
            .run(sessionId, input.agentId, input.inferenceSessionId ?? null, createdAt, input.resetMessage ?? null);
        return sessionId;
    }

    private sessionParse(row: DatabaseSessionRow): SessionDbRecord {
        return {
            id: row.id,
            agentId: row.agent_id,
            inferenceSessionId: row.inference_session_id,
            createdAt: row.created_at,
            resetMessage: row.reset_message
        };
    }
}
