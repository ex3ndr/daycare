import type { Config } from "@/types";
import { databaseOpenEnsured } from "./databaseOpenEnsured.js";
import { agentDbParse } from "./agentDbParse.js";
import type { AgentDbRecord, DatabaseAgentRow } from "./databaseTypes.js";

/**
 * Reads one agent row by id.
 * Expects: db schema is migrated before access.
 */
export async function agentDbRead(config: Config, agentId: string): Promise<AgentDbRecord | null> {
  const db = databaseOpenEnsured(config.dbPath);
  try {
    const row = db.prepare("SELECT * FROM agents WHERE id = ? LIMIT 1").get(
      agentId
    ) as DatabaseAgentRow | undefined;
    if (!row) {
      return null;
    }
    return agentDbParse(row);
  } finally {
    db.close();
  }
}
