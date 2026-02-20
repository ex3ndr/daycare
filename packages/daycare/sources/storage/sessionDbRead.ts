import type { Config } from "@/types";
import { databaseOpenEnsured } from "./databaseOpenEnsured.js";
import type { DatabaseSessionRow, SessionDbRecord } from "./databaseTypes.js";
import { sessionDbParse } from "./sessionDbParse.js";

/**
 * Reads one session row by id.
 * Expects: db schema is migrated before access.
 */
export async function sessionDbRead(
  config: Config,
  sessionId: string
): Promise<SessionDbRecord | null> {
  const db = databaseOpenEnsured(config.dbPath);
  try {
    const row = db.prepare("SELECT * FROM sessions WHERE id = ? LIMIT 1").get(
      sessionId
    ) as DatabaseSessionRow | undefined;
    if (!row) {
      return null;
    }
    return sessionDbParse(row);
  } finally {
    db.close();
  }
}
