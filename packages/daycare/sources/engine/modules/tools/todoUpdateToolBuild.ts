import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { TODO_STATUSES } from "../../../todos/todoTypes.js";

const schema = Type.Object(
    {
        todoId: Type.String({ minLength: 1 }),
        title: Type.Optional(Type.String({ minLength: 1 })),
        description: Type.Optional(Type.String()),
        status: Type.Optional(Type.Union(TODO_STATUSES.map((status) => Type.Literal(status))))
    },
    { additionalProperties: false }
);

type TodoUpdateArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        todoId: Type.String(),
        status: Type.String()
    },
    { additionalProperties: false }
);

type TodoUpdateResult = Static<typeof resultSchema>;

const returns: ToolResultContract<TodoUpdateResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the todo_update tool for patching todo metadata and status.
 * Expects: payload includes at least one field besides todoId.
 */
export function todoUpdateToolBuild(): ToolDefinition<typeof schema, TodoUpdateResult> {
    return {
        tool: {
            name: "todo_update",
            description:
                "Update a todo's title, description, or status. Setting status to abandoned archives the todo and all children.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const storage = toolContext.storage ?? toolContext.agentSystem.storage;
            if (!storage) {
                throw new Error("Storage is not available.");
            }

            const payload = args as TodoUpdateArgs;
            if (payload.title === undefined && payload.description === undefined && payload.status === undefined) {
                throw new Error("At least one field is required.");
            }

            const todo = await storage.todos.update(toolContext.ctx, payload.todoId.trim(), {
                title: payload.title?.trim(),
                description: payload.description,
                status: payload.status
            });
            const summary = `Updated todo ${todo.id}: ${todo.title} [${todo.status}].`;
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
