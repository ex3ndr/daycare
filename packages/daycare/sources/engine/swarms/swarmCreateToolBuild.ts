import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { swarmNameNormalize } from "./swarmNameNormalize.js";
import type { SwarmConfig } from "./swarmTypes.js";

const schema = Type.Object(
    {
        nametag: Type.String({ minLength: 1 }),
        firstName: Type.String({ minLength: 1 }),
        lastName: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
        bio: Type.String({ minLength: 1 }),
        about: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
        systemPrompt: Type.String({ minLength: 1 }),
        memory: Type.Optional(Type.Boolean())
    },
    { additionalProperties: false }
);

type SwarmCreateToolArgs = Static<typeof schema>;

const swarmCreateToolResultSchema = Type.Object(
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

type SwarmCreateToolResult = Static<typeof swarmCreateToolResultSchema>;

const swarmCreateToolReturns: ToolResultContract<SwarmCreateToolResult> = {
    schema: swarmCreateToolResultSchema,
    toLLMText: (result) => result.summary
};

type SwarmsFacade = {
    create: (
        ownerUserId: string,
        config: SwarmConfig
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
 * Builds the swarm_create tool available to owner user agents.
 * Expects: caller context belongs to the owner user.
 */
export function swarmCreateToolBuild(swarms: SwarmsFacade): ToolDefinition {
    return {
        tool: {
            name: "swarm_create",
            description: "Create a swarm user that can be targeted via send_user_message by nametag.",
            parameters: schema
        },
        returns: swarmCreateToolReturns,
        visibleByDefault: (context) => context.config.foreground === true,
        execute: async (args, toolContext, toolCall) => {
            const caller = await toolContext.agentSystem.storage.users.findById(toolContext.ctx.userId);
            if (!caller?.isOwner) {
                throw new Error("Only the owner user can create swarms.");
            }

            const payload = args as SwarmCreateToolArgs;
            const config: SwarmConfig = {
                nametag: swarmNameNormalize(payload.nametag),
                firstName: payload.firstName.trim(),
                lastName: payload.lastName?.trim() ?? null,
                bio: payload.bio.trim(),
                about: payload.about?.trim() ?? null,
                systemPrompt: payload.systemPrompt.trim(),
                memory: payload.memory ?? false
            };
            if (!config.firstName) {
                throw new Error("Swarm firstName is required.");
            }
            if (!config.bio) {
                throw new Error("Swarm bio is required.");
            }
            if (!config.systemPrompt) {
                throw new Error("Swarm systemPrompt is required.");
            }

            const created = await swarms.create(toolContext.ctx.userId, config);
            await swarms.discover(toolContext.ctx.userId);
            toolContext.agentSystem.refreshSandboxesForUserId(toolContext.ctx.userId);

            const summary = `Swarm created: ${created.nametag} (${created.userId}).`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: summary }],
                details: {
                    swarmUserId: created.userId,
                    swarmNametag: created.nametag
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
