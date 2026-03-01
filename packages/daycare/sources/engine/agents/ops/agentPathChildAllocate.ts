import type { AgentPath } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { agentPathSearch, agentPathSub } from "./agentPathBuild.js";
import { agentPath } from "./agentPathTypes.js";

type AgentPathChildAllocateInput = {
    storage?: Pick<Storage, "agents"> | null;
    parentAgentId: string;
    kind: "sub" | "search";
};

/**
 * Allocates the next child path under a parent agent using nextSubIndex.
 * Expects: parent agent exists and belongs to the current runtime user scope.
 */
export async function agentPathChildAllocate(input: AgentPathChildAllocateInput): Promise<AgentPath> {
    const agents = (input.storage as { agents?: Storage["agents"] } | null | undefined)?.agents;
    if (!agents?.findById || !agents.update) {
        // Tool-level unit tests often pass minimal facades without repositories.
        const syntheticRoot = agentPath(`/runtime/agent/${input.parentAgentId}`);
        if (input.kind === "search") {
            return agentPathSearch(syntheticRoot, 0);
        }
        return agentPathSub(syntheticRoot, 0);
    }

    const parent = await agents.findById(input.parentAgentId);
    if (!parent) {
        throw new Error(`Parent agent not found: ${input.parentAgentId}`);
    }
    const parentPath = parent.path;
    const nextIndex = parent.nextSubIndex ?? 0;
    await agents.update(parent.id, {
        nextSubIndex: nextIndex + 1,
        updatedAt: Date.now()
    });
    if (input.kind === "search") {
        return agentPathSearch(parentPath, nextIndex);
    }
    return agentPathSub(parentPath, nextIndex);
}
