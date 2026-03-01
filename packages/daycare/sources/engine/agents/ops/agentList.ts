import type { AgentConfig, AgentPath, Config } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import type { AgentLifecycleState } from "./agentTypes.js";

/**
 * Lists persisted agents with descriptors and last-updated timestamps.
 * Expects: storage migrations are applied before listing.
 */
export async function agentList(storageOrConfig: Storage | Config): Promise<
    Array<{
        agentId: string;
        path: AgentPath;
        config: AgentConfig;
        lifecycle: AgentLifecycleState;
        updatedAt: number;
    }>
> {
    const storage = storageResolve(storageOrConfig);
    const records = await storage.agents.findMany();
    return records.map((record) => ({
        agentId: record.id,
        path: record.path,
        config: {
            kind: record.kind,
            modelRole: record.modelRole,
            connectorName: record.connectorName,
            parentAgentId: record.parentAgentId,
            foreground: record.foreground,
            name: record.name,
            description: record.description,
            systemPrompt: record.systemPrompt,
            workspaceDir: record.workspaceDir
        },
        lifecycle: record.lifecycle,
        updatedAt: record.updatedAt
    }));
}
