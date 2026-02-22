import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { taskIdIsSafe } from "../../../utils/taskIdIsSafe.js";
import type { Crons } from "../../cron/crons.js";
import { cronExpressionParse as parseCronExpression } from "../../cron/ops/cronExpressionParse.js";

const addCronSchema = Type.Object(
    {
        id: Type.Optional(
            Type.String({ minLength: 1, description: "Custom task id (slug). Auto-generated from name if omitted." })
        ),
        name: Type.String({ minLength: 1, description: "Human-readable task name." }),
        description: Type.Optional(
            Type.String({ minLength: 1, description: "Optional description of what this task does." })
        ),
        schedule: Type.String({
            minLength: 1,
            description: "5-field cron expression (minute hour day month weekday)."
        }),
        prompt: Type.String({ minLength: 1, description: "The prompt text to execute when the task fires." }),
        agentId: Type.Optional(
            Type.String({ minLength: 1, description: "Target agent id. Omit to use the system cron agent." })
        ),
        enabled: Type.Optional(Type.Boolean({ description: "Whether the task is enabled. Defaults to true." })),
        deleteAfterRun: Type.Optional(
            Type.Boolean({ description: "Set to true for one-shot tasks that self-remove after running once." })
        )
    },
    { additionalProperties: false }
);

const readCronTaskSchema = Type.Object(
    {
        taskId: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

const deleteCronTaskSchema = Type.Object(
    {
        taskId: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type AddCronToolArgs = Static<typeof addCronSchema>;
type CronReadTaskArgs = Static<typeof readCronTaskSchema>;
type CronDeleteTaskArgs = Static<typeof deleteCronTaskSchema>;

const cronResultSchema = Type.Object(
    {
        summary: Type.String(),
        taskId: Type.String(),
        name: Type.Optional(Type.String()),
        schedule: Type.Optional(Type.String()),
        deleted: Type.Optional(Type.Boolean()),
        bytes: Type.Optional(Type.Number()),
        recordCount: Type.Optional(Type.Number())
    },
    { additionalProperties: false }
);

type CronResult = Static<typeof cronResultSchema>;

const cronReturns: ToolResultContract<CronResult> = {
    schema: cronResultSchema,
    toLLMText: (result) => result.summary
};

export function buildCronTool(crons: Crons): ToolDefinition {
    return {
        tool: {
            name: "cron_add",
            description:
                "Create a scheduled cron task. Set deleteAfterRun=true for one-shot tasks that self-remove after execution.",
            parameters: addCronSchema
        },
        returns: cronReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as AddCronToolArgs;

            if (!parseCronExpression(payload.schedule)) {
                throw new Error(`Invalid cron schedule: ${payload.schedule}`);
            }

            if (payload.id && !taskIdIsSafe(payload.id)) {
                throw new Error("Cron task id contains invalid characters.");
            }

            const task = await crons.addTask(toolContext.ctx, {
                id: payload.id,
                name: payload.name,
                description: payload.description,
                schedule: payload.schedule,
                prompt: payload.prompt,
                agentId: payload.agentId,
                enabled: payload.enabled,
                deleteAfterRun: payload.deleteAfterRun
            });

            const summary = `Scheduled cron task ${task.id} (${task.name}) with schedule ${task.schedule}.`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [
                    {
                        type: "text",
                        text: summary
                    }
                ],
                details: {
                    taskId: task.id,
                    name: task.name,
                    schedule: task.schedule,
                    agentId: task.agentId ?? null
                },
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    taskId: task.id,
                    name: task.name,
                    schedule: task.schedule
                }
            };
        }
    };
}

export function buildCronReadTaskTool(crons: Crons): ToolDefinition {
    return {
        tool: {
            name: "cron_read_task",
            description: "Read a cron task's description and prompt.",
            parameters: readCronTaskSchema
        },
        returns: cronReturns,
        execute: async (args, _context, toolCall) => {
            const payload = args as CronReadTaskArgs;
            const taskId = payload.taskId;
            if (!taskIdIsSafe(taskId)) {
                throw new Error("Cron task id contains invalid characters.");
            }
            const task = await crons.loadTask(taskId);
            if (!task) {
                throw new Error(`Cron task not found: ${taskId}`);
            }

            const summary = [task.description ?? "", task.prompt].filter((line) => line.length > 0).join("\n");
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [
                    {
                        type: "text",
                        text: task.description ?? ""
                    },
                    {
                        type: "text",
                        text: task.prompt
                    }
                ],
                details: {
                    taskId: task.id,
                    name: task.name,
                    description: task.description ?? null,
                    schedule: task.schedule,
                    agentId: task.agentId ?? null,
                    enabled: task.enabled,
                    deleteAfterRun: task.deleteAfterRun,
                    prompt: task.prompt
                },
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    taskId: task.id,
                    name: task.name,
                    schedule: task.schedule
                }
            };
        }
    };
}

export function buildCronDeleteTaskTool(crons: Crons): ToolDefinition {
    return {
        tool: {
            name: "cron_delete_task",
            description: "Delete a cron task from scheduler and SQLite.",
            parameters: deleteCronTaskSchema
        },
        returns: cronReturns,
        execute: async (args, context, toolCall) => {
            const payload = args as CronDeleteTaskArgs;
            const taskId = payload.taskId;
            if (!taskIdIsSafe(taskId)) {
                throw new Error("Cron task id contains invalid characters.");
            }
            const deleted = await crons.deleteTask(context.ctx, taskId);

            const summary = deleted ? `Deleted cron task ${taskId}.` : `Cron task not found: ${taskId}.`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [
                    {
                        type: "text",
                        text: summary
                    }
                ],
                details: { taskId, deleted },
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    taskId,
                    deleted
                }
            };
        }
    };
}
