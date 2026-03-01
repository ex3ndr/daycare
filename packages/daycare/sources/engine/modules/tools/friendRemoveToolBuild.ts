import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import type { Friends } from "../../friends/friends.js";

const schema = Type.Object(
    {
        nametag: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type FriendRemoveArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        status: Type.String(),
        nametag: Type.String()
    },
    { additionalProperties: false }
);

type FriendRemoveResult = Static<typeof resultSchema>;

const returns: ToolResultContract<FriendRemoveResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Removes, rejects, or cancels a friend relationship by nametag.
 * Expects: caller is a frontend user with a generated nametag.
 */
export function friendRemoveToolBuild(friends: Pick<Friends, "remove">): ToolDefinition {
    return {
        tool: {
            name: "friend_remove",
            description: "Unfriend, reject a request, or cancel a pending request by nametag.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type === "user",
        execute: async (args, toolContext, toolCall) => {
            const payload = args as FriendRemoveArgs;
            const result = await friends.remove(toolContext.ctx, { nametag: payload.nametag });
            return success(result.status, result.nametag, toolCall);
        }
    };
}

function success(status: FriendRemoveResult["status"], nametag: string, toolCall: { id: string; name: string }) {
    const summary =
        status === "unfriended"
            ? `Removed ${nametag} from friends.`
            : status === "rejected"
              ? `Rejected friend request from ${nametag}.`
              : `Canceled pending friend request to ${nametag}.`;
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
            status,
            nametag
        }
    };
}
