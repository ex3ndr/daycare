import type { Config } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import type { AgentDescriptor } from "./agentDescriptorTypes.js";
import type { AgentLifecycleState } from "./agentTypes.js";

/**
 * Lists persisted agents with descriptors and last-updated timestamps.
 * Expects: storage migrations are applied before listing.
 */
export async function agentList(
    storageOrConfig: Storage | Config
): Promise<Array<{ agentId: string; descriptor: AgentDescriptor; lifecycle: AgentLifecycleState; updatedAt: number }>> {
    const storage = storageResolve(storageOrConfig);
    const records = await storage.agents.findMany();
    return records.map((record) => ({
        agentId: record.id,
        descriptor: record.descriptor,
        lifecycle: record.lifecycle,
        updatedAt: record.updatedAt
    }));
}
