import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { todoTreeFormat } from "../../../utils/todoTreeFormat.js";

const schema = Type.Object(
    {
        rootId: Type.Optional(Type.String({ minLength: 1 })),
        depth: Type.Optional(Type.Integer({ minimum: 0 }))
    },
    { additionalProperties: false }
);

type TodoListArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        todoCount: Type.Number()
    },
    { additionalProperties: false }
);

type TodoListResult = Static<typeof resultSchema>;

const returns: ToolResultContract<TodoListResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the todo_list tool for listing workspace todos as an ASCII tree.
 * Expects: storage.todos is available for the current workspace context.
 */
export function todoListToolBuild(): ToolDefinition<typeof schema, TodoListResult> {
    return {
        tool: {
            name: "todo_list",
            description:
                "List workspace todos as an indented ASCII tree. Returns top two levels by default. Pass rootId to view a subtree, depth to control levels.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const storage = toolContext.storage ?? toolContext.agentSystem.storage;
            if (!storage) {
                throw new Error("Storage is not available.");
            }

            const payload = args as TodoListArgs;
            const todos = await storage.todos.findTree(
                toolContext.ctx,
                payload.rootId?.trim() || undefined,
                payload.depth
            );
            const summary = todoTreeFormat(todos);
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
                    todoCount: todos.length
                }
            };
        }
    };
}
