import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import type { WorkspaceConfig } from "./workspaceTypes.js";

const schema = Type.Object(
    {
        firstName: Type.String({ minLength: 1 }),
        lastName: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
        bio: Type.String({ minLength: 1 }),
        about: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
        systemPrompt: Type.String({ minLength: 1 }),
        memory: Type.Optional(Type.Boolean())
    },
    { additionalProperties: false }
);

type WorkspaceCreateToolArgs = Static<typeof schema>;

const workspaceCreateToolResultSchema = Type.Object(
    {
        summary: Type.String(),
        userId: Type.String(),
        nametag: Type.String(),
        firstName: Type.String(),
        lastName: Type.Union([Type.String(), Type.Null()]),
        memory: Type.Boolean()
    },
    { additionalProperties: false }
);

type WorkspaceCreateToolResult = Static<typeof workspaceCreateToolResultSchema>;

const workspaceCreateToolReturns: ToolResultContract<WorkspaceCreateToolResult> = {
    schema: workspaceCreateToolResultSchema,
    toLLMText: (result) => result.summary
};

type WorkspacesFacade = {
    create: (
        ownerUserId: string,
        config: WorkspaceConfig
    ) => Promise<{
        userId: string;
        nametag: string;
        firstName: string;
        lastName: string | null;
        memory: boolean;
    }>;
    discover: (ownerUserId: string) => Promise<unknown>;
};

/**
 * Builds the workspace_create tool available to owner user agents.
 * Expects: caller context belongs to the owner user.
 */
export function workspaceCreateToolBuild(workspaces: WorkspacesFacade): ToolDefinition {
    return {
        tool: {
            name: "workspace_create",
            description: "Create a workspace user that can be targeted via send_user_message.",
            parameters: schema
        },
        returns: workspaceCreateToolReturns,
        visibleByDefault: (context) => context.config.foreground === true,
        execute: async (args, toolContext, toolCall) => {
            const caller = await toolContext.agentSystem.storage.users.findById(toolContext.ctx.userId);
            if (!caller?.isOwner) {
                throw new Error("Only the owner user can create workspaces.");
            }

            const payload = args as WorkspaceCreateToolArgs;
            const config: WorkspaceConfig = {
                firstName: payload.firstName.trim(),
                lastName: payload.lastName?.trim() ?? null,
                bio: payload.bio.trim(),
                about: payload.about?.trim() ?? null,
                systemPrompt: payload.systemPrompt.trim(),
                memory: payload.memory ?? false
            };
            if (!config.firstName) {
                throw new Error("Workspace firstName is required.");
            }
            if (!config.bio) {
                throw new Error("Workspace bio is required.");
            }
            if (!config.systemPrompt) {
                throw new Error("Workspace systemPrompt is required.");
            }

            const created = await workspaces.create(toolContext.ctx.userId, config);
            await workspaces.discover(toolContext.ctx.userId);
            toolContext.agentSystem.refreshSandboxesForUserId(toolContext.ctx.userId);

            const summary = `Workspace created: ${created.nametag} (${created.userId}).`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: summary }],
                details: {
                    workspaceUserId: created.userId,
                    workspaceNametag: created.nametag
                },
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    userId: created.userId,
                    nametag: created.nametag,
                    firstName: created.firstName,
                    lastName: created.lastName,
                    memory: created.memory
                }
            };
        }
    };
}
