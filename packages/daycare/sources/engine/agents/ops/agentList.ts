import type { Config } from "@/types";
import { agentDbList } from "../../../storage/agentDbList.js";
import type { AgentDescriptor } from "./agentDescriptorTypes.js";
import type { AgentLifecycleState } from "./agentTypes.js";

/**
 * Lists persisted agents with descriptors and last-updated timestamps.
 * Expects: storage migrations are applied before listing.
 */
export async function agentList(
    config: Config
): Promise<Array<{ agentId: string; descriptor: AgentDescriptor; lifecycle: AgentLifecycleState; updatedAt: number }>> {
    const records = await agentDbList(config);
    return records.map((record) => ({
        agentId: record.id,
        descriptor: record.descriptor,
        lifecycle: record.lifecycle,
        updatedAt: record.updatedAt
    }));
}
