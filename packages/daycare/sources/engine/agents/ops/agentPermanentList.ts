import type { Config } from "@/types";
import { agentDbList } from "../../../storage/agentDbList.js";
import type { PermanentAgentSummary } from "./agentPermanentTypes.js";

/**
 * Lists persisted permanent agents with descriptors and timestamps.
 * Expects: storage migrations are applied before listing.
 */
export async function agentPermanentList(config: Config): Promise<PermanentAgentSummary[]> {
    const records = await agentDbList(config);
    const results: PermanentAgentSummary[] = [];

    for (const record of records) {
        const descriptor = record.descriptor;
        if (descriptor.type !== "permanent") {
            continue;
        }
        results.push({
            agentId: record.id,
            descriptor: {
                ...descriptor,
                name: descriptor.name.trim(),
                ...(descriptor.username ? { username: descriptor.username.trim() } : {}),
                description: descriptor.description.trim(),
                systemPrompt: descriptor.systemPrompt.trim(),
                ...(descriptor.workspaceDir ? { workspaceDir: descriptor.workspaceDir } : {})
            },
            updatedAt: record.updatedAt
        });
    }

    return results;
}
