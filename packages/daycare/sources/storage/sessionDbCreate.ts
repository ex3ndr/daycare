import { createId } from "@paralleldrive/cuid2";

import type { Config } from "@/types";
import { databaseOpenEnsured } from "./databaseOpenEnsured.js";

type SessionDbCreateInput = {
    agentId: string;
    inferenceSessionId?: string | null;
    createdAt?: number;
    resetMessage?: string | null;
};

/**
 * Inserts a new session row and returns its id.
 * Expects: referenced agent already exists.
 */
export async function sessionDbCreate(config: Config, input: SessionDbCreateInput): Promise<string> {
    const now = input.createdAt ?? Date.now();
    const sessionId = createId();
    const db = databaseOpenEnsured(config.dbPath);
    try {
        db.prepare(
            `
        INSERT INTO sessions (
          id,
          agent_id,
          inference_session_id,
          created_at,
          reset_message
        ) VALUES (?, ?, ?, ?, ?)
      `
        ).run(sessionId, input.agentId, input.inferenceSessionId ?? null, now, input.resetMessage ?? null);
        return sessionId;
    } finally {
        db.close();
    }
}
