import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import type { Friends } from "../../friends/friends.js";

const schema = Type.Object(
    {
        friendNametag: Type.String({ minLength: 1 }),
        subuserId: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type FriendUnshareSubuserArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        status: Type.String(),
        friendNametag: Type.String(),
        subuserId: Type.String()
    },
    { additionalProperties: false }
);

type FriendUnshareSubuserResult = Static<typeof resultSchema>;

const returns: ToolResultContract<FriendUnshareSubuserResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Revokes a previously offered/active subuser share from a friend.
 * Expects: caller owns subuserId and an existing share request from the subuser side is present.
 */
export function friendUnshareSubuserToolBuild(friends: Pick<Friends, "unshareSubuser">): ToolDefinition {
    return {
        tool: {
            name: "friend_unshare_subuser",
            description: "Revoke a subuser share from a friend by nametag.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type !== "subuser",
        execute: async (args, toolContext, toolCall) => {
            const payload = args as FriendUnshareSubuserArgs;
            const result = await friends.unshareSubuser(toolContext.ctx, {
                friendNametag: payload.friendNametag,
                subuserId: payload.subuserId
            });

            const summary = `Revoked subuser ${result.subuserId} share from ${result.friendNametag}.`;
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
                    status: result.status,
                    friendNametag: result.friendNametag,
                    subuserId: result.subuserId
                }
            };
        }
    };
}
