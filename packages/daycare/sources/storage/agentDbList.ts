import type { Config } from "@/types";
import { agentDbParse } from "./agentDbParse.js";
import { databaseOpenEnsured } from "./databaseOpenEnsured.js";
import type { AgentDbRecord, DatabaseAgentRow } from "./databaseTypes.js";

/**
 * Lists all persisted agents.
 * Expects: db schema is migrated before access.
 */
export async function agentDbList(config: Config): Promise<AgentDbRecord[]> {
    const db = databaseOpenEnsured(config.dbPath);
    try {
        const rows = db.prepare("SELECT * FROM agents ORDER BY updated_at ASC").all() as DatabaseAgentRow[];
        return rows.map((row) => agentDbParse(row));
    } finally {
        db.close();
    }
}
