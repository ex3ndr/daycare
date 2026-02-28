import { asc, eq } from "drizzle-orm";
import type { DaycareDb } from "../schema.js";
import { inboxTable } from "../schema.js";
import type { InboxDbRecord } from "./databaseTypes.js";

/**
 * Inbox repository for durable queued agent inbox entries.
 * Expects: schema migrations already applied for the inbox table.
 */
export class InboxRepository {
    private readonly db: DaycareDb;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async insert(id: string, agentId: string, postedAt: number, type: string, data: string): Promise<void> {
        await this.db
            .insert(inboxTable)
            .values({ id, agentId, postedAt, type, data })
            .onConflictDoUpdate({
                target: inboxTable.id,
                set: { agentId, postedAt, type, data }
            });
    }

    async findByAgentId(agentId: string): Promise<InboxDbRecord[]> {
        const rows = await this.db
            .select()
            .from(inboxTable)
            .where(eq(inboxTable.agentId, agentId))
            .orderBy(asc(inboxTable.postedAt), asc(inboxTable.id));
        return rows.map((row) => ({
            id: row.id,
            agentId: row.agentId,
            postedAt: row.postedAt,
            type: row.type,
            data: row.data
        }));
    }

    async delete(id: string): Promise<void> {
        await this.db.delete(inboxTable).where(eq(inboxTable.id, id));
    }

    async deleteByAgentId(agentId: string): Promise<void> {
        await this.db.delete(inboxTable).where(eq(inboxTable.agentId, agentId));
    }
}
