import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import type { DaycareDb } from "../schema.js";
import { sessionsTable } from "../schema.js";
import type { CreateSessionInput, SessionDbRecord } from "./databaseTypes.js";

/**
 * Sessions repository backed by Drizzle without caching.
 * Expects: schema migrations already applied for sessions.
 */
export class SessionsRepository {
    private readonly db: DaycareDb;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async findById(id: string): Promise<SessionDbRecord | null> {
        const rows = await this.db.select().from(sessionsTable).where(eq(sessionsTable.id, id)).limit(1);
        const first = rows[0];
        if (!first) {
            return null;
        }
        return sessionParse(first);
    }

    async findByAgentId(agentId: string): Promise<SessionDbRecord[]> {
        const rows = await this.db
            .select()
            .from(sessionsTable)
            .where(eq(sessionsTable.agentId, agentId))
            .orderBy(asc(sessionsTable.createdAt));
        return rows.map((row) => sessionParse(row));
    }

    async create(input: CreateSessionInput): Promise<string> {
        const sessionId = createId();
        const createdAt = input.createdAt ?? Date.now();
        await this.db.insert(sessionsTable).values({
            id: sessionId,
            agentId: input.agentId,
            inferenceSessionId: input.inferenceSessionId ?? null,
            createdAt,
            resetMessage: input.resetMessage ?? null,
            invalidatedAt: null,
            processedUntil: null
        });
        return sessionId;
    }

    /**
     * Marks a session as ended by setting ended_at.
     * Expects: sessionId is valid.
     */
    async endSession(sessionId: string, endedAt: number): Promise<void> {
        await this.db
            .update(sessionsTable)
            .set({ endedAt })
            .where(and(eq(sessionsTable.id, sessionId), isNull(sessionsTable.endedAt)));
    }

    /**
     * Marks a session as needing memory processing.
     * Sets invalidated_at only if null or if historyId is larger.
     * Expects: sessionId and historyId are valid.
     */
    async invalidate(sessionId: string, historyId: number): Promise<void> {
        await this.db
            .update(sessionsTable)
            .set({ invalidatedAt: historyId })
            .where(
                and(
                    eq(sessionsTable.id, sessionId),
                    or(isNull(sessionsTable.invalidatedAt), lt(sessionsTable.invalidatedAt, historyId))
                )
            );
    }

    /**
     * Returns sessions that need memory processing, ordered by invalidated_at ASC.
     * Expects: limit > 0.
     */
    async findInvalidated(limit: number): Promise<SessionDbRecord[]> {
        const rows = await this.db
            .select()
            .from(sessionsTable)
            .where(isNotNull(sessionsTable.invalidatedAt))
            .orderBy(asc(sessionsTable.invalidatedAt))
            .limit(limit);
        return rows.map((row) => sessionParse(row));
    }

    /**
     * CAS update: clears invalidated_at and sets processed_until,
     * but only if invalidated_at still matches the expected value.
     * Returns true if the update was applied.
     */
    async markProcessed(sessionId: string, processedUntil: number, expectedInvalidatedAt: number): Promise<boolean> {
        const result = await this.db
            .update(sessionsTable)
            .set({ invalidatedAt: null, processedUntil })
            .where(and(eq(sessionsTable.id, sessionId), eq(sessionsTable.invalidatedAt, expectedInvalidatedAt)))
            .returning({ id: sessionsTable.id });
        return result.length === 1;
    }
}

function sessionParse(row: typeof sessionsTable.$inferSelect): SessionDbRecord {
    return {
        id: row.id,
        agentId: row.agentId,
        inferenceSessionId: row.inferenceSessionId,
        createdAt: row.createdAt,
        resetMessage: row.resetMessage,
        invalidatedAt: row.invalidatedAt ?? null,
        processedUntil: row.processedUntil ?? null,
        endedAt: row.endedAt ?? null
    };
}
