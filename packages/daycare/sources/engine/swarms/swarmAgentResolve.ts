import type { AgentPath } from "@/types";
import type { AgentSystem } from "../agents/agentSystem.js";
import { contextForUser } from "../agents/context.js";
import { agentPathAgent } from "../agents/ops/agentPathBuild.js";

type SwarmAgentResolveInput = {
    swarmUserId: string;
    contactAgentId: string;
    agentSystem: Pick<AgentSystem, "agentIdForTarget" | "storage">;
};

export type SwarmAgentResolved = {
    swarmAgentId: string;
    path: AgentPath;
};

/**
 * Resolves the persistent swarm agent identity and records contact mapping.
 * Expects: swarmUserId belongs to an existing swarm user.
 */
export async function swarmAgentResolve(input: SwarmAgentResolveInput): Promise<SwarmAgentResolved> {
    const swarmUserId = input.swarmUserId.trim();
    const contactAgentId = input.contactAgentId.trim();
    if (!swarmUserId) {
        throw new Error("swarmUserId is required.");
    }
    if (!contactAgentId) {
        throw new Error("contactAgentId is required.");
    }

    const swarmUser = await input.agentSystem.storage.users.findById(swarmUserId);
    if (!swarmUser || !swarmUser.isSwarm) {
        throw new Error(`Swarm not found: ${swarmUserId}`);
    }

    const contactAgent = await input.agentSystem.storage.agents.findById(contactAgentId);
    if (!contactAgent) {
        throw new Error(`Contact agent not found: ${contactAgentId}`);
    }

    const path = agentPathAgent(swarmUser.id, "swarm");
    const swarmCtx = contextForUser({ userId: swarmUserId });
    const swarmAgentId = await input.agentSystem.agentIdForTarget(
        swarmCtx,
        { path },
        {
            kind: "swarm",
            foreground: true,
            name: "swarm"
        }
    );
    await input.agentSystem.storage.swarmContacts.findOrCreate(swarmUserId, contactAgentId, swarmAgentId);

    return {
        swarmAgentId,
        path
    };
}
