import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolExecutionContext, ToolResultContract } from "@/types";
import { agentDescriptorWrite } from "../../agents/ops/agentDescriptorWrite.js";
import { permissionBuildUser } from "../../permissions/permissionBuildUser.js";

const schema = Type.Object(
    {
        subuserId: Type.String({ minLength: 1 }),
        systemPrompt: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type SubuserConfigureArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        subuserId: Type.String(),
        gatewayAgentId: Type.String()
    },
    { additionalProperties: false }
);

type SubuserConfigureResult = Static<typeof resultSchema>;

const returns: ToolResultContract<SubuserConfigureResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the subuser_configure tool that updates a subuser gateway agent's system prompt.
 * Expects: caller is the owner user; subuserId references an existing child user.
 */
export function subuserConfigureToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "subuser_configure",
            description:
                "Update the system prompt of a subuser's gateway agent. Only the owner can configure subusers.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type !== "subuser",
        execute: async (args, toolContext, toolCall) => {
            const payload = args as SubuserConfigureArgs;
            const subuserId = payload.subuserId.trim();
            if (!subuserId) {
                throw new Error("Subuser ID is required.");
            }
            const systemPrompt = payload.systemPrompt.trim();
            if (!systemPrompt) {
                throw new Error("System prompt is required.");
            }

            await assertCallerIsOwner(toolContext);

            const storage = toolContext.agentSystem.storage;

            // Verify subuser exists and belongs to the caller
            const subuser = await storage.users.findById(subuserId);
            if (!subuser) {
                throw new Error("Subuser not found.");
            }
            if (subuser.parentUserId !== toolContext.ctx.userId) {
                throw new Error("Subuser does not belong to the calling user.");
            }

            // Find the gateway agent (type "subuser" with descriptor.id matching subuserId)
            const agents = await storage.agents.findMany();
            const gatewayAgent = agents.find(
                (agent) => agent.descriptor.type === "subuser" && agent.descriptor.id === subuserId
            );
            if (!gatewayAgent) {
                throw new Error("Gateway agent not found for this subuser.");
            }

            // Update descriptor with new system prompt
            const updatedDescriptor = {
                ...gatewayAgent.descriptor,
                systemPrompt
            };
            const subuserHome = toolContext.agentSystem.userHomeForUserId(subuserId);
            const permissions = permissionBuildUser(subuserHome);
            await agentDescriptorWrite(storage, gatewayAgent.id, updatedDescriptor, subuserId, permissions);
            toolContext.agentSystem.updateAgentDescriptor(gatewayAgent.id, updatedDescriptor);

            const summary = `Subuser ${subuserId} gateway agent ${gatewayAgent.id} system prompt updated.`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: summary }],
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    subuserId,
                    gatewayAgentId: gatewayAgent.id
                }
            };
        }
    };
}

async function assertCallerIsOwner(toolContext: ToolExecutionContext): Promise<void> {
    const userId = toolContext.ctx?.userId;
    if (!userId) {
        throw new Error("Tool context userId is required.");
    }
    const user = await toolContext.agentSystem.storage.users.findById(userId);
    if (!user || !user.isOwner) {
        throw new Error("Only the owner user can configure subusers.");
    }
}
