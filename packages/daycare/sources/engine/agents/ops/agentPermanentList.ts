import type { Config } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import type { PermanentAgentSummary } from "./agentPermanentTypes.js";

/**
 * Lists persisted permanent agents with config metadata and timestamps.
 * Expects: storage migrations are applied before listing.
 */
export async function agentPermanentList(storageOrConfig: Storage | Config): Promise<PermanentAgentSummary[]> {
    const storage = storageResolve(storageOrConfig);
    const records = await storage.agents.findMany();
    const results: PermanentAgentSummary[] = [];

    for (const record of records) {
        if (record.kind !== "agent") {
            continue;
        }
        if (!record.name || !record.systemPrompt) {
            continue;
        }
        results.push({
            agentId: record.id,
            name: record.name.trim(),
            description: record.description?.trim() ?? "",
            systemPrompt: record.systemPrompt.trim(),
            workspaceDir: record.workspaceDir ?? null,
            updatedAt: record.updatedAt
        });
    }

    return results;
}
