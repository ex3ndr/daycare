import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolExecutionContext, ToolResultContract } from "@/types";
import { contextForAgent } from "../../agents/context.js";
import { agentDescriptorWrite } from "../../agents/ops/agentDescriptorWrite.js";
import { agentStateWrite } from "../../agents/ops/agentStateWrite.js";
import { permissionBuildUser } from "../../permissions/permissionBuildUser.js";
import { userHomeEnsure } from "../../users/userHomeEnsure.js";

const schema = Type.Object(
    {
        name: Type.String({ minLength: 1 }),
        systemPrompt: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type SubuserCreateArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        subuserId: Type.String(),
        gatewayAgentId: Type.String(),
        name: Type.String()
    },
    { additionalProperties: false }
);

type SubuserCreateResult = Static<typeof resultSchema>;

const returns: ToolResultContract<SubuserCreateResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the subuser_create tool that provisions an isolated child user with a gateway agent.
 * Expects: caller is the owner user; name and systemPrompt are non-empty.
 */
export function subuserCreateToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "subuser_create",
            description:
                "Create an isolated subuser with its own memory, filesystem, and a gateway agent. " +
                "Only the owner can create subusers. The gateway agent receives messages forwarded by owner agents.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type !== "subuser",
        execute: async (args, toolContext, toolCall) => {
            const payload = args as SubuserCreateArgs;
            const name = payload.name.trim();
            if (!name) {
                throw new Error("Subuser name is required.");
            }
            const systemPrompt = payload.systemPrompt.trim();
            if (!systemPrompt) {
                throw new Error("Subuser system prompt is required.");
            }

            await assertCallerIsOwner(toolContext);

            const storage = toolContext.agentSystem.storage;
            const subuserId = createId();
            const now = Date.now();

            // Create child user
            await storage.users.create({
                id: subuserId,
                parentUserId: toolContext.ctx.userId,
                name,
                createdAt: now,
                updatedAt: now
            });

            // Ensure subuser home directories
            const subuserHome = toolContext.agentSystem.userHomeForUserId(subuserId);
            await userHomeEnsure(subuserHome);

            // Create gateway agent belonging to the subuser
            const gatewayAgentId = createId();
            const descriptor = {
                type: "subuser" as const,
                id: subuserId,
                name,
                systemPrompt
            };
            const permissions = permissionBuildUser(subuserHome);
            await agentDescriptorWrite(
                storage,
                contextForAgent({ userId: subuserId, agentId: gatewayAgentId }),
                descriptor,
                permissions
            );

            // Create a session and write agent state in one step
            const inferenceSessionId = createId();
            const sessionId = await storage.sessions.create({
                agentId: gatewayAgentId,
                inferenceSessionId,
                createdAt: now
            });
            await agentStateWrite(storage, contextForAgent({ userId: subuserId, agentId: gatewayAgentId }), {
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

            const summary = `Subuser created: ${subuserId} (name: ${name}). Gateway agent: ${gatewayAgentId}.`;
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
                    gatewayAgentId,
                    name
                }
            };
        }
    };
}

async function assertCallerIsOwner(toolContext: ToolExecutionContext): Promise<void> {
    const userId = toolContext.ctx.userId;
    if (!userId) {
        throw new Error("Tool context userId is required.");
    }
    const user = await toolContext.agentSystem.storage.users.findById(userId);
    if (!user || !user.isOwner) {
        throw new Error("Only the owner user can create subusers.");
    }
}
