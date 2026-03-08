import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";

const schema = Type.Object(
    {
        todoId: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type TodoArchiveArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        todoId: Type.String()
    },
    { additionalProperties: false }
);

type TodoArchiveResult = Static<typeof resultSchema>;

const returns: ToolResultContract<TodoArchiveResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the todo_archive tool for abandoning a todo subtree.
 * Expects: todoId resolves inside the current workspace scope.
 */
export function todoArchiveToolBuild(): ToolDefinition<typeof schema, TodoArchiveResult> {
    return {
        tool: {
            name: "todo_archive",
            description: "Archive a todo and all of its descendants by setting them to abandoned.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const storage = toolContext.storage ?? toolContext.agentSystem.storage;
            if (!storage) {
                throw new Error("Storage is not available.");
            }

            const payload = args as TodoArchiveArgs;
            const todoId = payload.todoId.trim();
            await storage.todos.archive(toolContext.ctx, todoId);
            const summary = `Archived todo ${todoId} and its descendants.`;
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
                    todoId
                }
            };
        }
    };
}
