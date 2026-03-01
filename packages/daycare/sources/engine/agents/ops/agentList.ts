import type { AgentConfig, AgentPath, Config } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import type { AgentDescriptor } from "./agentDescriptorTypes.js";
import type { AgentLifecycleState } from "./agentTypes.js";

/**
 * Lists persisted agents with descriptors and last-updated timestamps.
 * Expects: storage migrations are applied before listing.
 */
export async function agentList(storageOrConfig: Storage | Config): Promise<
    Array<{
        agentId: string;
        path: AgentPath | null;
        config: AgentConfig | null;
        descriptor: AgentDescriptor;
        lifecycle: AgentLifecycleState;
        updatedAt: number;
    }>
> {
    const storage = storageResolve(storageOrConfig);
    const records = await storage.agents.findMany();
    return records.map((record) => ({
        agentId: record.id,
        path: record.path ?? null,
        config: record.config ?? null,
        descriptor: record.descriptor,
        lifecycle: record.lifecycle,
        updatedAt: record.updatedAt
    }));
}
