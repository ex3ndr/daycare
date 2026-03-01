import type { Config } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import type { AgentKind } from "./agentConfigTypes.js";
import type { BackgroundAgentState } from "./agentTypes.js";

/**
 * Lists persisted background agents with coarse status (no in-memory queue data).
 * Expects: storage migrations are applied before listing.
 */
export async function agentBackgroundList(storageOrConfig: Storage | Config): Promise<BackgroundAgentState[]> {
    const storage = storageResolve(storageOrConfig);
    const records = await storage.agents.findMany();
    const results: BackgroundAgentState[] = [];

    for (const record of records) {
        if (record.foreground) {
            continue;
        }
        const name = agentNameResolve(record.kind, record.name);
        const parentAgentId = record.parentAgentId ?? null;

        results.push({
            agentId: record.id,
            name,
            parentAgentId,
            lifecycle: record.lifecycle,
            status: "idle",
            pending: 0,
            updatedAt: record.updatedAt
        });
    }

    return results;
}

function agentNameResolve(kind: AgentKind, name: string | null): string | null {
    if (name?.trim()) {
        return name.trim();
    }
    if (kind === "memory") {
        return "memory-agent";
    }
    if (kind === "search") {
        return "memory-search";
    }
    if (kind === "sub") {
        return "subagent";
    }
    if (kind === "connector") {
        return "user";
    }
    return null;
}
