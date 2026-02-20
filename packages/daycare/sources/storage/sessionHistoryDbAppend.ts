import type { AgentHistoryRecord, Config } from "@/types";
import { databaseOpenEnsured } from "./databaseOpenEnsured.js";

type SessionHistoryDbAppendInput = {
    sessionId: string;
    record: AgentHistoryRecord;
};

/**
 * Appends one history record to a session.
 * Expects: record belongs to the provided session id.
 */
export async function sessionHistoryDbAppend(config: Config, input: SessionHistoryDbAppendInput): Promise<void> {
    const { type, at, ...data } = input.record;
    const db = databaseOpenEnsured(config.dbPath);
    try {
        db.prepare(
            `
        INSERT INTO session_history (session_id, type, at, data)
        VALUES (?, ?, ?, ?)
      `
        ).run(input.sessionId, type, at, JSON.stringify(data));
    } finally {
        db.close();
    }
}
