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

type FriendShareSubuserArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        status: Type.String(),
        friendNametag: Type.String(),
        subuserId: Type.String(),
        subuserNametag: Type.String()
    },
    { additionalProperties: false }
);

type FriendShareSubuserResult = Static<typeof resultSchema>;

const returns: ToolResultContract<FriendShareSubuserResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Shares one of the caller-owned subusers with an existing friend.
 * Expects: caller owns subuserId and caller is already friends with friendNametag.
 */
export function friendShareSubuserToolBuild(friends: Pick<Friends, "shareSubuser">): ToolDefinition {
    return {
        tool: {
            name: "friend_share_subuser",
            description: "Share one of your subusers with a friend by nametag.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type !== "subuser",
        execute: async (args, toolContext, toolCall) => {
            const payload = args as FriendShareSubuserArgs;
            const result = await friends.shareSubuser(toolContext.ctx, {
                friendNametag: payload.friendNametag,
                subuserId: payload.subuserId
            });

            const summary = `Shared subuser ${result.subuserId} with ${result.friendNametag}.`;
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
                    subuserId: result.subuserId,
                    subuserNametag: result.subuserNametag
                }
            };
        }
    };
}
