import { and, asc, eq, gt, max } from "drizzle-orm";
import type { AgentHistoryRecord } from "@/types";
import type { DaycareDb } from "../schema.js";
import { sessionHistoryTable, sessionsTable } from "../schema.js";

/**
 * Session history repository backed by Drizzle without caching.
 * Expects: schema migrations already applied for session_history.
 */
export class HistoryRepository {
    private readonly db: DaycareDb;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async findBySessionId(sessionId: string): Promise<AgentHistoryRecord[]> {
        const rows = await this.db
            .select()
            .from(sessionHistoryTable)
            .where(eq(sessionHistoryTable.sessionId, sessionId))
            .orderBy(asc(sessionHistoryTable.id));

        return rows.map((row) => historyParse(row)).filter((record): record is AgentHistoryRecord => record !== null);
    }

    async findByAgentId(agentId: string, limit?: number): Promise<AgentHistoryRecord[]> {
        let query = this.db
            .select({
                id: sessionHistoryTable.id,
                sessionId: sessionHistoryTable.sessionId,
                type: sessionHistoryTable.type,
                at: sessionHistoryTable.at,
                data: sessionHistoryTable.data
            })
            .from(sessionHistoryTable)
            .innerJoin(sessionsTable, eq(sessionHistoryTable.sessionId, sessionsTable.id))
            .where(eq(sessionsTable.agentId, agentId))
            .orderBy(asc(sessionsTable.createdAt), asc(sessionHistoryTable.id))
            .$dynamic();

        if (limit !== undefined) {
            query = query.limit(limit);
        }

        const rows = await query;

        return rows.map((row) => historyParse(row)).filter((record): record is AgentHistoryRecord => record !== null);
    }

    /**
     * Appends a history record and returns the new auto-increment id.
     * Expects: sessionId references an existing session.
     */
    async append(sessionId: string, record: AgentHistoryRecord): Promise<number> {
        const { type, at, ...data } = record;
        const inserted = await this.db
            .insert(sessionHistoryTable)
            .values({
                sessionId,
                type,
                at,
                data: JSON.stringify(data)
            })
            .returning({ id: sessionHistoryTable.id });
        const first = inserted[0];
        if (!first) {
            throw new Error("Failed to append history record.");
        }
        return first.id;
    }

    /**
     * Returns history records after a given id for a session, ordered by id ASC.
     * Expects: afterId >= 0; returns empty array when no records exist after afterId.
     */
    async findSinceId(sessionId: string, afterId: number): Promise<AgentHistoryRecord[]> {
        const rows = await this.db
            .select()
            .from(sessionHistoryTable)
            .where(and(eq(sessionHistoryTable.sessionId, sessionId), gt(sessionHistoryTable.id, afterId)))
            .orderBy(asc(sessionHistoryTable.id));
        return rows.map((row) => historyParse(row)).filter((record): record is AgentHistoryRecord => record !== null);
    }

    /**
     * Returns the maximum history record id for a session.
     * Returns null when the session has no history records.
     */
    async maxId(sessionId: string): Promise<number | null> {
        const rows = await this.db
            .select({ maxId: max(sessionHistoryTable.id) })
            .from(sessionHistoryTable)
            .where(eq(sessionHistoryTable.sessionId, sessionId));
        const first = rows[0];
        if (!first || first.maxId === null) {
            return null;
        }
        return first.maxId;
    }
}

function historyParse(row: { type: string; at: number; data: string }): AgentHistoryRecord | null {
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
