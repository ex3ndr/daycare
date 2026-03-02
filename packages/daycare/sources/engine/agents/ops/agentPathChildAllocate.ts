import type { AgentPath } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { AsyncLock } from "../../../utils/lock.js";
import { agentPathSearch, agentPathSub } from "./agentPathBuild.js";
import { agentPath } from "./agentPathTypes.js";

type AgentPathChildAllocateInput = {
    storage?: Pick<Storage, "agents"> | null;
    parentAgentId: string;
    kind: "sub" | "search";
};

const parentAllocationLocks = new Map<string, AsyncLock>();

function parentAllocationLockFor(parentAgentId: string): AsyncLock {
    const existing = parentAllocationLocks.get(parentAgentId);
    if (existing) {
        return existing;
    }
    const created = new AsyncLock();
    parentAllocationLocks.set(parentAgentId, created);
    return created;
}

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

    const lock = parentAllocationLockFor(input.parentAgentId);
    return lock.inLock(async () => {
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
    });
}
