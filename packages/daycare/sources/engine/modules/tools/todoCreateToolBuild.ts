import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { TODO_STATUSES } from "../../../todos/todoTypes.js";

const schema = Type.Object(
    {
        title: Type.String({ minLength: 1 }),
        description: Type.Optional(Type.String()),
        status: Type.Optional(Type.Union(TODO_STATUSES.map((status) => Type.Literal(status)))),
        parentId: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

type TodoCreateArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        todoId: Type.String(),
        status: Type.String()
    },
    { additionalProperties: false }
);

type TodoCreateResult = Static<typeof resultSchema>;

const returns: ToolResultContract<TodoCreateResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the todo_create tool for creating workspace todos.
 * Expects: storage.todos is available for the current workspace context.
 */
export function todoCreateToolBuild(): ToolDefinition<typeof schema, TodoCreateResult> {
    return {
        tool: {
            name: "todo_create",
            description:
                "Create a todo. Pass parentId to nest it under an existing todo. Defaults to unstarted status.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const storage = toolContext.storage ?? toolContext.agentSystem.storage;
            if (!storage) {
                throw new Error("Storage is not available.");
            }

            const payload = args as TodoCreateArgs;
            const todo = await storage.todos.create(toolContext.ctx, {
                title: payload.title.trim(),
                description: payload.description,
                status: payload.status,
                parentId: payload.parentId?.trim() || null
            });
            const summary = `Created todo ${todo.id}: ${todo.title} [${todo.status}].`;
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
                    status: todo.status
                }
            };
        }
    };
}
