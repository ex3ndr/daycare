import type { Config, Context } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import type { AgentState } from "./agentTypes.js";

/**
 * Reads agent state from SQLite storage.
 * Expects: migrations have been applied before reads.
 */
export async function agentStateRead(storageOrConfig: Storage | Config, ctx: Context): Promise<AgentState | null> {
    const storage = storageResolve(storageOrConfig);
    const record = await storage.agents.findById(ctx.agentId);
    if (!record) {
        return null;
    }

    const activeSession = record.activeSessionId ? await storage.sessions.findById(record.activeSessionId) : null;

    return {
        context: {
            messages: []
        },
        activeSessionId: record.activeSessionId ?? null,
        inferenceSessionId: activeSession?.inferenceSessionId ?? undefined,
        permissions: record.permissions,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        state: record.lifecycle
    };
}
