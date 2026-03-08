import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { TODO_STATUSES } from "../../../todos/todoTypes.js";

const schema = Type.Object(
    {
        ids: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
        status: Type.Union(TODO_STATUSES.map((status) => Type.Literal(status)))
    },
    { additionalProperties: false }
);

type TodoBatchStatusArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        updatedCount: Type.Number()
    },
    { additionalProperties: false }
);

type TodoBatchStatusResult = Static<typeof resultSchema>;

const returns: ToolResultContract<TodoBatchStatusResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the todo_batch_status tool for bulk todo status changes.
 * Expects: ids contains one or more todo ids.
 */
export function todoBatchStatusToolBuild(): ToolDefinition<typeof schema, TodoBatchStatusResult> {
    return {
        tool: {
            name: "todo_batch_status",
            description: "Update the status of multiple todos in one call.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const storage = toolContext.storage ?? toolContext.agentSystem.storage;
            if (!storage) {
                throw new Error("Storage is not available.");
            }

            const payload = args as TodoBatchStatusArgs;
            const updated = await storage.todos.batchUpdateStatus(
                toolContext.ctx,
                payload.ids.map((id) => id.trim()),
                payload.status
            );
            const summary = `Updated ${updated.length} todos to ${payload.status}.`;
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
                    updatedCount: updated.length
                }
            };
        }
    };
}
