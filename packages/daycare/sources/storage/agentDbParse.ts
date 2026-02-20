import type {
    AgentDescriptor,
    AgentLifecycleState,
    AgentTokenEntry,
    AgentTokenStats,
    SessionPermissions
} from "@/types";
import type { AgentDbRecord, DatabaseAgentRow } from "./databaseTypes.js";

/**
 * Parses a raw agents table row into a typed agent record.
 * Expects: JSON columns contain valid serialized values.
 */
export function agentDbParse(row: DatabaseAgentRow): AgentDbRecord {
    return {
        id: row.id,
        userId: row.user_id,
        type: row.type,
        descriptor: JSON.parse(row.descriptor) as AgentDescriptor,
        activeSessionId: row.active_session_id,
        permissions: JSON.parse(row.permissions) as SessionPermissions,
        tokens: row.tokens ? (JSON.parse(row.tokens) as AgentTokenEntry) : null,
        stats: JSON.parse(row.stats) as AgentTokenStats,
        lifecycle: row.lifecycle as AgentLifecycleState,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}
