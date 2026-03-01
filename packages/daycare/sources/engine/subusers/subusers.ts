import { createId } from "@paralleldrive/cuid2";
import type { Context } from "@/types";
import type { Storage } from "../../storage/storage.js";
import { contextForAgent } from "../agents/context.js";
import type { AgentDescriptor } from "../agents/ops/agentDescriptorTypes.js";
import { agentDescriptorWrite } from "../agents/ops/agentDescriptorWrite.js";
import { agentStateWrite } from "../agents/ops/agentStateWrite.js";
import { TOPO_EVENT_TYPES, TOPO_SOURCE_SUBUSERS, topographyObservationEmit } from "../observations/topographyEvents.js";
import { permissionBuildUser } from "../permissions/permissionBuildUser.js";
import type { UserHome } from "../users/userHome.js";
import { userHomeEnsure } from "../users/userHomeEnsure.js";

export type SubusersOptions = {
    storage: Storage;
    userHomeForUserId: (userId: string) => UserHome;
    updateAgentDescriptor: (agentId: string, descriptor: AgentDescriptor) => void;
};

/**
 * Coordinates subuser lifecycle operations for owner users.
 * Expects: caller context belongs to an owner user.
 */
export class Subusers {
    private readonly storage: Storage;
    private readonly userHomeForUserId: (userId: string) => UserHome;
    private readonly updateAgentDescriptor: (agentId: string, descriptor: AgentDescriptor) => void;

    constructor(options: SubusersOptions) {
        this.storage = options.storage;
        this.userHomeForUserId = options.userHomeForUserId;
        this.updateAgentDescriptor = options.updateAgentDescriptor;
    }

    async create(
        ctx: Context,
        input: { name: string; systemPrompt: string }
    ): Promise<{
        subuserId: string;
        gatewayAgentId: string;
        name: string;
    }> {
        const ownerUserId = ctx.userId.trim();
        if (!ownerUserId) {
            throw new Error("Tool context userId is required.");
        }
        const name = input.name.trim();
        if (!name) {
            throw new Error("Subuser name is required.");
        }
        const systemPrompt = input.systemPrompt.trim();
        if (!systemPrompt) {
            throw new Error("Subuser system prompt is required.");
        }

        await this.ownerAssert(ownerUserId, "create");

        const subuserId = createId();
        const now = Date.now();
        const createdUser = await this.storage.users.create({
            id: subuserId,
            parentUserId: ownerUserId,
            name,
            createdAt: now,
            updatedAt: now
        });

        const subuserHome = this.userHomeForUserId(subuserId);
        await userHomeEnsure(subuserHome);

        const gatewayAgentId = createId();
        const descriptor: AgentDescriptor = {
            type: "subuser",
            id: subuserId,
            name,
            systemPrompt
        };
        const permissions = permissionBuildUser(subuserHome);
        await agentDescriptorWrite(
            this.storage,
            contextForAgent({ userId: subuserId, agentId: gatewayAgentId }),
            descriptor,
            permissions
        );

        const inferenceSessionId = createId();
        const sessionId = await this.storage.sessions.create({
            agentId: gatewayAgentId,
            inferenceSessionId,
            createdAt: now
        });
        await agentStateWrite(this.storage, contextForAgent({ userId: subuserId, agentId: gatewayAgentId }), {
            context: { messages: [] },
            activeSessionId: sessionId,
            inferenceSessionId,
            permissions,
            tokens: null,
            stats: {},
            createdAt: now,
            updatedAt: now,
            state: "active"
        });

        await topographyObservationEmit(this.storage.observationLog, {
            userId: ownerUserId,
            type: TOPO_EVENT_TYPES.SUBUSER_CREATED,
            source: TOPO_SOURCE_SUBUSERS,
            message: `Subuser created: ${name}`,
            details: `Subuser ${subuserId} created for owner ${ownerUserId} with name "${name}"`,
            data: {
                subuserId,
                ownerUserId,
                name: createdUser.name,
                nametag: createdUser.nametag,
                gatewayAgentId
            },
            scopeIds: [ownerUserId, subuserId]
        });

        return { subuserId, gatewayAgentId, name };
    }

    async configure(
        ctx: Context,
        input: { subuserId: string; systemPrompt: string }
    ): Promise<{
        subuserId: string;
        gatewayAgentId: string;
    }> {
        const ownerUserId = ctx.userId.trim();
        if (!ownerUserId) {
            throw new Error("Tool context userId is required.");
        }
        const subuserId = input.subuserId.trim();
        if (!subuserId) {
            throw new Error("Subuser ID is required.");
        }
        const systemPrompt = input.systemPrompt.trim();
        if (!systemPrompt) {
            throw new Error("System prompt is required.");
        }

        await this.ownerAssert(ownerUserId, "configure");

        const subuser = await this.storage.users.findById(subuserId);
        if (!subuser) {
            throw new Error("Subuser not found.");
        }
        if (subuser.parentUserId !== ownerUserId) {
            throw new Error("Subuser does not belong to the calling user.");
        }

        const agents = await this.storage.agents.findMany();
        const gatewayAgent = agents.find(
            (agent) => agent.descriptor.type === "subuser" && agent.descriptor.id === subuserId
        );
        if (!gatewayAgent || gatewayAgent.descriptor.type !== "subuser") {
            throw new Error("Gateway agent not found for this subuser.");
        }

        const updatedDescriptor: AgentDescriptor = {
            ...gatewayAgent.descriptor,
            systemPrompt
        };
        const subuserHome = this.userHomeForUserId(subuserId);
        const permissions = permissionBuildUser(subuserHome);
        await agentDescriptorWrite(
            this.storage,
            contextForAgent({ userId: subuserId, agentId: gatewayAgent.id }),
            updatedDescriptor,
            permissions
        );
        this.updateAgentDescriptor(gatewayAgent.id, updatedDescriptor);

        await topographyObservationEmit(this.storage.observationLog, {
            userId: ownerUserId,
            type: TOPO_EVENT_TYPES.SUBUSER_CONFIGURED,
            source: TOPO_SOURCE_SUBUSERS,
            message: `Subuser configured: ${subuser.name ?? subuser.id}`,
            details: `Subuser ${subuser.id} gateway agent updated`,
            data: {
                subuserId: subuser.id,
                ownerUserId,
                name: subuser.name,
                gatewayAgentId: gatewayAgent.id
            },
            scopeIds: [ownerUserId, subuser.id]
        });

        return {
            subuserId: subuser.id,
            gatewayAgentId: gatewayAgent.id
        };
    }

    private async ownerAssert(userId: string, operation: "create" | "configure"): Promise<void> {
        const user = await this.storage.users.findById(userId);
        if (!user || !user.isOwner) {
            if (operation === "create") {
                throw new Error("Only the owner user can create subusers.");
            }
            throw new Error("Only the owner user can configure subusers.");
        }
    }
}
