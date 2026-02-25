import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { stringSlugify } from "../../../utils/stringSlugify.js";
import { taskIdIsSafe } from "../../../utils/taskIdIsSafe.js";
import { contextForUser } from "../../agents/context.js";
import { cronExpressionParse } from "../../cron/ops/cronExpressionParse.js";

const taskCreateSchema = Type.Object(
    {
        title: Type.String({ minLength: 1 }),
        code: Type.String({
            minLength: 1,
            description:
                "Python code executed when the task triggers. Can call tools directly. " +
                "To produce a prompt for the agent: print/return text (the output becomes LLM context). " +
                "To do work without LLM inference: call tools then call skip()."
        }),
        description: Type.Optional(Type.String()),
        cron: Type.Optional(Type.String({ minLength: 1, description: "Cron expression (e.g. '0 * * * *')." })),
        heartbeat: Type.Optional(Type.Boolean({ description: "Attach a heartbeat trigger (~30 min interval)." })),
        agentId: Type.Optional(
            Type.String({
                minLength: 1,
                description: "Route to a specific agent instead of the default system agent."
            })
        )
    },
    { additionalProperties: false }
);

const taskReadSchema = Type.Object(
    {
        taskId: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

const taskUpdateSchema = Type.Object(
    {
        taskId: Type.String({ minLength: 1 }),
        title: Type.Optional(Type.String({ minLength: 1 })),
        code: Type.Optional(
            Type.String({
                minLength: 1,
                description: "Python code. Print/return text to produce an LLM prompt, or call tools and skip()."
            })
        ),
        description: Type.Optional(Type.String())
    },
    { additionalProperties: false }
);

const taskDeleteSchema = Type.Object(
    {
        taskId: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

const taskRunSchema = Type.Object(
    {
        taskId: Type.String({ minLength: 1 }),
        agentId: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

const taskTriggerAddSchema = Type.Object(
    {
        taskId: Type.String({ minLength: 1 }),
        type: Type.Union([Type.Literal("cron"), Type.Literal("heartbeat")]),
        schedule: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

const taskTriggerRemoveSchema = Type.Object(
    {
        taskId: Type.String({ minLength: 1 }),
        type: Type.Union([Type.Literal("cron"), Type.Literal("heartbeat")])
    },
    { additionalProperties: false }
);

type TaskCreateArgs = Static<typeof taskCreateSchema>;
type TaskReadArgs = Static<typeof taskReadSchema>;
type TaskUpdateArgs = Static<typeof taskUpdateSchema>;
type TaskDeleteArgs = Static<typeof taskDeleteSchema>;
type TaskRunArgs = Static<typeof taskRunSchema>;
type TaskTriggerAddArgs = Static<typeof taskTriggerAddSchema>;
type TaskTriggerRemoveArgs = Static<typeof taskTriggerRemoveSchema>;

const taskResultSchema = Type.Object(
    {
        summary: Type.String(),
        taskId: Type.String(),
        cronTriggerId: Type.Optional(Type.String()),
        heartbeatTriggerId: Type.Optional(Type.String()),
        deleted: Type.Optional(Type.Boolean()),
        removed: Type.Optional(Type.Boolean()),
        removedCount: Type.Optional(Type.Number())
    },
    { additionalProperties: false }
);

type TaskResult = Static<typeof taskResultSchema>;

const taskReturns: ToolResultContract<TaskResult> = {
    schema: taskResultSchema,
    toLLMText: (result) => result.summary
};

export function buildTaskCreateTool(): ToolDefinition {
    return {
        tool: {
            name: "task_create",
            description:
                "Create a reusable task with Python code and optionally attach cron/heartbeat triggers. " +
                "Code runs as Python with full tool access. Print/return text to produce an LLM prompt, " +
                "or call tools and skip() to do work without LLM inference.",
            parameters: taskCreateSchema
        },
        returns: taskReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as TaskCreateArgs;
            const storage = toolContext.agentSystem.storage;
            const userId = toolContext.ctx.userId.trim();
            if (!userId) {
                throw new Error("Task userId is required.");
            }

            if (payload.cron && !cronExpressionParse(payload.cron)) {
                throw new Error(`Invalid cron schedule: ${payload.cron}`);
            }

            const taskId = await taskIdGenerateFromTitle(storage, payload.title);
            const now = Date.now();

            let cronTrigger: { id: string; duplicate: boolean } | null = null;
            let heartbeatTrigger: { id: string; duplicate: boolean } | null = null;

            try {
                await storage.tasks.create({
                    id: taskId,
                    userId,
                    title: payload.title,
                    description: payload.description ?? null,
                    code: payload.code,
                    createdAt: now,
                    updatedAt: now
                });

                if (payload.cron) {
                    cronTrigger = await taskCronTriggerEnsure(toolContext, taskId, payload.cron, payload.agentId);
                }

                if (payload.heartbeat === true) {
                    heartbeatTrigger = await taskHeartbeatTriggerEnsure(toolContext, taskId);
                }
            } catch (error) {
                if (cronTrigger && !cronTrigger.duplicate) {
                    await toolContext.agentSystem.crons.deleteTask(toolContext.ctx, cronTrigger.id).catch(() => {});
                }
                if (heartbeatTrigger && !heartbeatTrigger.duplicate) {
                    await toolContext.heartbeats.removeTask(toolContext.ctx, heartbeatTrigger.id).catch(() => {});
                }
                await storage.tasks.delete(taskId).catch(() => {});
                throw error;
            }

            const summaryParts = [`Created task ${taskId}.`];
            if (cronTrigger) {
                summaryParts.push(
                    cronTrigger.duplicate
                        ? `Using existing cron trigger ${cronTrigger.id}.`
                        : `Added cron trigger ${cronTrigger.id}.`
                );
            }
            if (heartbeatTrigger) {
                summaryParts.push(
                    heartbeatTrigger.duplicate
                        ? `Using existing heartbeat trigger ${heartbeatTrigger.id}.`
                        : `Added heartbeat trigger ${heartbeatTrigger.id}.`
                );
            }
            const summary = summaryParts.join(" ");
            const typedResult: TaskResult = {
                summary,
                taskId,
                ...(cronTrigger ? { cronTriggerId: cronTrigger.id } : {}),
                ...(heartbeatTrigger ? { heartbeatTriggerId: heartbeatTrigger.id } : {})
            };

            return {
                toolMessage: toolMessageBuild(toolCall.id, toolCall.name, summary, {
                    taskId,
                    cronTriggerId: cronTrigger?.id ?? null,
                    cronTriggerDuplicate: cronTrigger?.duplicate ?? false,
                    heartbeatTriggerId: heartbeatTrigger?.id ?? null,
                    heartbeatTriggerDuplicate: heartbeatTrigger?.duplicate ?? false
                }),
                typedResult
            };
        }
    };
}

export function buildTaskReadTool(): ToolDefinition {
    return {
        tool: {
            name: "task_read",
            description: "Read a task and list its linked cron/heartbeat triggers.",
            parameters: taskReadSchema
        },
        returns: taskReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as TaskReadArgs;
            const task = await taskResolveForUser(toolContext, payload.taskId);
            const [cronTriggers, heartbeatTriggers] = await Promise.all([
                toolContext.agentSystem.crons.listTriggersForTask(task.id),
                toolContext.heartbeats.listTriggersForTask(task.id)
            ]);
            const cronLines = cronTriggers.map((trigger) => `  - ${trigger.id} (cron: ${trigger.schedule})`);
            const heartbeatLines = heartbeatTriggers.map((trigger) => `  - ${trigger.id} (heartbeat)`);

            const lines = [
                `Task ${task.id}: ${task.title}`,
                `Description: ${task.description ?? "(none)"}`,
                `Cron triggers: ${cronTriggers.length}`,
                ...(cronLines.length > 0 ? cronLines : ["  - (none)"]),
                `Heartbeat triggers: ${heartbeatTriggers.length}`,
                ...(heartbeatLines.length > 0 ? heartbeatLines : ["  - (none)"]),
                "",
                task.code
            ];
            const summary = lines.join("\n");

            return {
                toolMessage: toolMessageBuild(toolCall.id, toolCall.name, summary, {
                    task,
                    cronTriggers,
                    heartbeatTriggers
                }),
                typedResult: {
                    summary,
                    taskId: task.id
                }
            };
        }
    };
}

export function buildTaskUpdateTool(): ToolDefinition {
    return {
        tool: {
            name: "task_update",
            description: "Update task title, Python code, or description.",
            parameters: taskUpdateSchema
        },
        returns: taskReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as TaskUpdateArgs;
            const task = await taskResolveForUser(toolContext, payload.taskId);
            if (payload.title === undefined && payload.code === undefined && payload.description === undefined) {
                throw new Error("Provide at least one field to update: title, code, or description.");
            }

            await toolContext.agentSystem.storage.tasks.update(task.id, {
                title: payload.title ?? task.title,
                code: payload.code ?? task.code,
                description: payload.description === undefined ? task.description : payload.description,
                updatedAt: Date.now()
            });

            const summary = `Updated task ${task.id}.`;
            return {
                toolMessage: toolMessageBuild(toolCall.id, toolCall.name, summary, { taskId: task.id }),
                typedResult: {
                    summary,
                    taskId: task.id
                }
            };
        }
    };
}

export function buildTaskDeleteTool(): ToolDefinition {
    return {
        tool: {
            name: "task_delete",
            description: "Delete a task and all linked cron/heartbeat triggers.",
            parameters: taskDeleteSchema
        },
        returns: taskReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as TaskDeleteArgs;
            const task = await taskResolveForUser(toolContext, payload.taskId);

            const [removedCron, removedHeartbeat] = await Promise.all([
                toolContext.agentSystem.crons.deleteTriggersForTask(toolContext.ctx, task.id),
                toolContext.heartbeats.deleteTriggersForTask(toolContext.ctx, task.id)
            ]);
            const deletedDirect = await toolContext.agentSystem.storage.tasks.delete(task.id);
            const deleted = deletedDirect || (await toolContext.agentSystem.storage.tasks.findById(task.id)) === null;
            const summary = deleted
                ? `Deleted task ${task.id} with ${removedCron} cron trigger(s) and ${removedHeartbeat} heartbeat trigger(s).`
                : `Task already removed: ${task.id}.`;

            return {
                toolMessage: toolMessageBuild(toolCall.id, toolCall.name, summary, {
                    taskId: task.id,
                    removedCron,
                    removedHeartbeat,
                    deleted
                }),
                typedResult: {
                    summary,
                    taskId: task.id,
                    deleted
                }
            };
        }
    };
}

export function buildTaskRunTool(): ToolDefinition {
    return {
        tool: {
            name: "task_run",
            description: "Execute a task's Python code immediately via the system task agent or a specific agentId.",
            parameters: taskRunSchema
        },
        returns: taskReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as TaskRunArgs;
            const task = await taskResolveForUser(toolContext, payload.taskId);
            const target = payload.agentId
                ? { agentId: payload.agentId }
                : { descriptor: { type: "system" as const, tag: "task" } };

            const text = ["[task]", `taskId: ${task.id}`, `taskTitle: ${task.title}`].join("\n");
            await toolContext.agentSystem.postAndAwait(contextForUser({ userId: task.userId }), target, {
                type: "system_message",
                text,
                code: [task.code],
                origin: "task",
                execute: true,
                context: toolContext.messageContext
            });

            const summary = `Task ${task.id} executed.`;
            return {
                toolMessage: toolMessageBuild(toolCall.id, toolCall.name, summary, {
                    taskId: task.id,
                    target
                }),
                typedResult: {
                    summary,
                    taskId: task.id
                }
            };
        }
    };
}

export function buildTaskTriggerAddTool(): ToolDefinition {
    return {
        tool: {
            name: "task_trigger_add",
            description: "Attach a cron or heartbeat trigger to an existing task.",
            parameters: taskTriggerAddSchema
        },
        returns: taskReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as TaskTriggerAddArgs;
            const task = await taskResolveForUser(toolContext, payload.taskId);

            if (payload.type === "cron") {
                if (!payload.schedule) {
                    throw new Error("schedule is required when type is cron.");
                }
                const ensured = await taskCronTriggerEnsure(toolContext, task.id, payload.schedule);
                const summary = ensured.duplicate
                    ? `Cron trigger for schedule ${payload.schedule.trim()} already exists on task ${task.id} (${ensured.id}).`
                    : `Added cron trigger ${ensured.id} to task ${task.id}.`;
                const typedResult: TaskResult = {
                    summary,
                    taskId: task.id,
                    cronTriggerId: ensured.id
                };
                return {
                    toolMessage: toolMessageBuild(toolCall.id, toolCall.name, summary, {
                        taskId: task.id,
                        cronTriggerId: ensured.id,
                        duplicate: ensured.duplicate
                    }),
                    typedResult
                };
            }

            const ensured = await taskHeartbeatTriggerEnsure(toolContext, task.id);
            const summary = ensured.duplicate
                ? `Heartbeat trigger already exists on task ${task.id} (${ensured.id}).`
                : `Added heartbeat trigger ${ensured.id} to task ${task.id}.`;
            const typedResult: TaskResult = {
                summary,
                taskId: task.id,
                heartbeatTriggerId: ensured.id
            };
            return {
                toolMessage: toolMessageBuild(toolCall.id, toolCall.name, summary, {
                    taskId: task.id,
                    heartbeatTriggerId: ensured.id,
                    duplicate: ensured.duplicate
                }),
                typedResult
            };
        }
    };
}

export function buildTaskTriggerRemoveTool(): ToolDefinition {
    return {
        tool: {
            name: "task_trigger_remove",
            description: "Remove a cron or heartbeat trigger from a task.",
            parameters: taskTriggerRemoveSchema
        },
        returns: taskReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as TaskTriggerRemoveArgs;
            const task = await taskResolveForUser(toolContext, payload.taskId);

            if (payload.type === "cron") {
                const removedCount = await toolContext.agentSystem.crons.deleteTriggersForTask(
                    toolContext.ctx,
                    task.id
                );
                const removed = removedCount > 0;
                const summary = removed
                    ? `Removed ${removedCount} cron trigger(s) from task ${task.id}.`
                    : `No cron trigger found for task ${task.id}.`;
                return {
                    toolMessage: toolMessageBuild(toolCall.id, toolCall.name, summary, {
                        taskId: task.id,
                        removed,
                        removedCount
                    }),
                    typedResult: {
                        summary,
                        taskId: task.id,
                        removed,
                        removedCount
                    }
                };
            }

            const removedCount = await toolContext.heartbeats.deleteTriggersForTask(toolContext.ctx, task.id);
            const removed = removedCount > 0;
            const summary = removed
                ? `Removed ${removedCount} heartbeat trigger(s) from task ${task.id}.`
                : `No heartbeat trigger found for task ${task.id}.`;
            return {
                toolMessage: toolMessageBuild(toolCall.id, toolCall.name, summary, {
                    taskId: task.id,
                    removed,
                    removedCount
                }),
                typedResult: {
                    summary,
                    taskId: task.id,
                    removed,
                    removedCount
                }
            };
        }
    };
}

async function taskResolveForUser(
    toolContext: Parameters<ToolDefinition["execute"]>[1],
    taskId: string
): Promise<{
    id: string;
    userId: string;
    title: string;
    description: string | null;
    code: string;
}> {
    const normalizedTaskId = taskId.trim();
    if (!taskIdIsSafe(normalizedTaskId)) {
        throw new Error("Task id contains invalid characters.");
    }
    const task = await toolContext.agentSystem.storage.tasks.findById(normalizedTaskId);
    if (!task || task.userId !== toolContext.ctx.userId.trim()) {
        throw new Error(`Task not found: ${normalizedTaskId}`);
    }
    return task;
}

function toolMessageBuild(
    toolCallId: string,
    toolName: string,
    text: string,
    details?: Record<string, unknown>
): ToolResultMessage {
    return {
        role: "toolResult",
        toolCallId,
        toolName,
        content: [{ type: "text", text }],
        details,
        isError: false,
        timestamp: Date.now()
    };
}

async function taskIdGenerateFromTitle(
    storage: Parameters<ToolDefinition["execute"]>[1]["agentSystem"]["storage"],
    title: string
): Promise<string> {
    const base = stringSlugify(title) || "task";
    let candidate = base;
    let suffix = 2;

    while (await storage.tasks.findAnyById(candidate)) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
    }

    return candidate;
}

async function taskCronTriggerEnsure(
    toolContext: Parameters<ToolDefinition["execute"]>[1],
    taskId: string,
    schedule: string,
    agentId?: string
): Promise<{ id: string; duplicate: boolean }> {
    const normalizedSchedule = schedule.trim();
    if (!cronExpressionParse(normalizedSchedule)) {
        throw new Error(`Invalid cron schedule: ${schedule}`);
    }

    const existing = await toolContext.agentSystem.crons.listTriggersForTask(taskId);
    const duplicate = existing.find((trigger) => trigger.schedule === normalizedSchedule);
    if (duplicate) {
        return { id: duplicate.id, duplicate: true };
    }

    const created = await toolContext.agentSystem.crons.addTrigger(toolContext.ctx, {
        taskId,
        schedule: normalizedSchedule,
        agentId
    });
    return { id: created.id, duplicate: false };
}

async function taskHeartbeatTriggerEnsure(
    toolContext: Parameters<ToolDefinition["execute"]>[1],
    taskId: string
): Promise<{ id: string; duplicate: boolean }> {
    const existing = await toolContext.heartbeats.listTriggersForTask(taskId);
    if (existing.length > 0) {
        return { id: existing[0]!.id, duplicate: true };
    }

    const created = await toolContext.heartbeats.addTrigger(toolContext.ctx, { taskId });
    return { id: created.id, duplicate: false };
}
