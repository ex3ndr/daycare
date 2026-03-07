import type { AgentPath } from "@/types";
import type { AgentSystem } from "../agents/agentSystem.js";
import { contextForUser } from "../agents/context.js";
import { agentPathAgent } from "../agents/ops/agentPathBuild.js";

type WorkspaceAgentResolveInput = {
    workspaceUserId: string;
    contactAgentId: string;
    agentSystem: Pick<AgentSystem, "agentIdForTarget" | "storage">;
};

export type WorkspaceAgentResolved = {
    workspaceAgentId: string;
    path: AgentPath;
};

/**
 * Resolves the persistent workspace agent identity and records contact mapping.
 * Expects: workspaceUserId belongs to an existing workspace user.
 */
export async function workspaceAgentResolve(input: WorkspaceAgentResolveInput): Promise<WorkspaceAgentResolved> {
    const workspaceUserId = input.workspaceUserId.trim();
    const contactAgentId = input.contactAgentId.trim();
    if (!workspaceUserId) {
        throw new Error("workspaceUserId is required.");
    }
    if (!contactAgentId) {
        throw new Error("contactAgentId is required.");
    }

    const workspaceUser = await input.agentSystem.storage.users.findById(workspaceUserId);
    if (!workspaceUser || !workspaceUser.isWorkspace) {
        throw new Error(`Workspace not found: ${workspaceUserId}`);
    }

    const contactAgent = await input.agentSystem.storage.agents.findById(contactAgentId);
    if (!contactAgent) {
        throw new Error(`Contact agent not found: ${contactAgentId}`);
    }

    const path = agentPathAgent(workspaceUser.id, "workspace");
    const workspaceCtx = contextForUser({ userId: workspaceUserId });
    const workspaceAgentId = await input.agentSystem.agentIdForTarget(
        workspaceCtx,
        { path },
        {
            kind: "workspace",
            foreground: true,
            name: "workspace"
        }
    );
    await input.agentSystem.storage.workspaceContacts.findOrCreate(workspaceUserId, contactAgentId, workspaceAgentId);

    return {
        workspaceAgentId,
        path
    };
}
