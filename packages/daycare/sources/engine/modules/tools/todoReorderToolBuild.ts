import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";

const schema = Type.Object(
    {
        todoId: Type.String({ minLength: 1 }),
        parentId: Type.Optional(Type.String({ minLength: 1 })),
        index: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
);

type TodoReorderArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        todoId: Type.String(),
        parentId: Type.Union([Type.String(), Type.Null()])
    },
    { additionalProperties: false }
);

type TodoReorderResult = Static<typeof resultSchema>;

const returns: ToolResultContract<TodoReorderResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the todo_reorder tool for moving todos within the hierarchy.
 * Expects: index is a non-negative integer.
 */
export function todoReorderToolBuild(): ToolDefinition<typeof schema, TodoReorderResult> {
    return {
        tool: {
            name: "todo_reorder",
            description: "Move a todo to a new parent and sibling index.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const storage = toolContext.storage ?? toolContext.agentSystem.storage;
            if (!storage) {
                throw new Error("Storage is not available.");
            }

            const payload = args as TodoReorderArgs;
            const todo = await storage.todos.reorder(
                toolContext.ctx,
                payload.todoId.trim(),
                payload.parentId?.trim() || null,
                payload.index
            );
            const target = todo.parentId ? `under parent ${todo.parentId}` : "at the root";
            const summary = `Moved todo ${todo.id} ${target}.`;
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
                    todoId: todo.id,
                    parentId: todo.parentId
                }
            };
        }
    };
}
