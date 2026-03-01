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

type FriendAddArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        status: Type.String(),
        nametag: Type.String()
    },
    { additionalProperties: false }
);

type FriendAddResult = Static<typeof resultSchema>;

const returns: ToolResultContract<FriendAddResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Sends or confirms a friend request by nametag.
 * Expects: caller is a frontend user with a generated nametag.
 */
export function friendAddToolBuild(friends: Pick<Friends, "add">): ToolDefinition {
    return {
        tool: {
            name: "friend_add",
            description: "Send or accept a friend request by nametag.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.config.foreground === true,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as FriendAddArgs;
            const result = await friends.add(toolContext.ctx, { nametag: payload.nametag });
            return success(result.status, result.nametag, toolCall);
        }
    };
}

function success(status: FriendAddResult["status"], nametag: string, toolCall: { id: string; name: string }) {
    const summary =
        status === "requested" ? `Friend request sent to ${nametag}.` : `${nametag} accepted. You are now friends.`;
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
