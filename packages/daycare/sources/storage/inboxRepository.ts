import type { StorageDatabase } from "./databaseOpen.js";
import type { DatabaseInboxRow, InboxDbRecord } from "./databaseTypes.js";

/**
 * Inbox repository for durable queued agent inbox entries.
 * Expects: schema migrations already applied for the inbox table.
 */
export class InboxRepository {
    private readonly db: StorageDatabase;

    constructor(db: StorageDatabase) {
        this.db = db;
    }

    async insert(id: string, agentId: string, postedAt: number, type: string, data: string): Promise<void> {
        this.db
            .prepare(
                `
                INSERT INTO inbox (
                    id,
                    agent_id,
                    posted_at,
                    type,
                    data
                ) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    agent_id = excluded.agent_id,
                    posted_at = excluded.posted_at,
                    type = excluded.type,
                    data = excluded.data
            `
            )
            .run(id, agentId, postedAt, type, data);
    }

    async findByAgentId(agentId: string): Promise<InboxDbRecord[]> {
        const rows = this.db
            .prepare("SELECT * FROM inbox WHERE agent_id = ? ORDER BY posted_at ASC, id ASC")
            .all(agentId) as DatabaseInboxRow[];
        return rows.map((row) => ({
            id: row.id,
            agentId: row.agent_id,
            postedAt: row.posted_at,
            type: row.type,
            data: row.data
        }));
    }

    async delete(id: string): Promise<void> {
        this.db.prepare("DELETE FROM inbox WHERE id = ?").run(id);
    }

    async deleteByAgentId(agentId: string): Promise<void> {
        this.db.prepare("DELETE FROM inbox WHERE agent_id = ?").run(agentId);
    }
}
