import type { Context } from "@mariozechner/pi-ai";

import type { Config } from "@/types";
import { agentDbRead } from "../../../storage/agentDbRead.js";
import { sessionDbRead } from "../../../storage/sessionDbRead.js";
import type { AgentState } from "./agentTypes.js";

/**
 * Reads agent state from SQLite storage.
 * Expects: migrations have been applied before reads.
 */
export async function agentStateRead(config: Config, agentId: string): Promise<AgentState | null> {
    const record = await agentDbRead(config, agentId);
    if (!record) {
        return null;
    }

    const activeSession = record.activeSessionId ? await sessionDbRead(config, record.activeSessionId) : null;

    return {
        context: {
            messages: [] as Context["messages"]
        },
        activeSessionId: record.activeSessionId ?? null,
        inferenceSessionId: activeSession?.inferenceSessionId ?? undefined,
        permissions: record.permissions,
        tokens: record.tokens,
        stats: record.stats,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        state: record.lifecycle
    };
}
