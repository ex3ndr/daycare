import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { appJwtSecretResolve } from "../../../api/app-server/appJwtSecretResolve.js";
import { JWT_SERVICE_WEBHOOK, jwtSign } from "../../../utils/jwt.js";
import { stringSlugify } from "../../../utils/stringSlugify.js";
import { taskIdIsSafe } from "../../../utils/taskIdIsSafe.js";
import { agentPathTask } from "../../agents/ops/agentPathBuild.js";
import { cronExpressionParse } from "../../cron/ops/cronExpressionParse.js";
import { cronTimezoneResolve } from "../../cron/ops/cronTimezoneResolve.js";
import { TOPO_EVENT_TYPES, TOPO_SOURCE_TASKS, topographyObservationEmit } from "../../observations/topographyEvents.js";
import { rlmVerify } from "../rlm/rlmVerify.js";
import { taskParameterPreambleStubs } from "../tasks/taskParameterCodegen.js";
import { taskParameterInputsNormalize } from "../tasks/taskParameterInputsNormalize.js";
import type { TaskParameter } from "../tasks/taskParameterTypes.js";
import { taskParameterValidate } from "../tasks/taskParameterValidate.js";

const taskParameterSchema = Type.Object(
    {
        name: Type.String({ minLength: 1 }),
        type: Type.Union([
            Type.Literal("integer"),
            Type.Literal("float"),
            Type.Literal("string"),
            Type.Literal("boolean"),
            Type.Literal("any")
        ]),
        nullable: Type.Boolean()
    },
    { additionalProperties: false }
);

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
        parameters: Type.Optional(
            Type.Array(taskParameterSchema, {
                description:
                    "Typed parameter schema. Each parameter becomes a Python variable injected into the code at runtime."
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
        description: Type.Optional(Type.String()),
        parameters: Type.Optional(
            Type.Array(taskParameterSchema, {
                description: "Updated parameter schema. Replaces the existing parameter list."
            })
        )
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
        agentId: Type.Optional(Type.String({ minLength: 1 })),
        parameters: Type.Optional(
            Type.Record(Type.String(), Type.Unknown(), {
                description: "Parameter values matching the task's parameter schema."
            })
        ),
        sync: Type.Optional(
            Type.Boolean({
                description:
                    "When true, waits for code execution to complete and returns the output directly " +
                    "instead of triggering LLM inference."
            })
        )
    },
    { additionalProperties: false }
);

const taskTriggerAddSchema = Type.Object(
    {
        taskId: Type.String({ minLength: 1 }),
        type: Type.Union([Type.Literal("cron"), Type.Literal("webhook")]),
        schedule: Type.Optional(Type.String({ minLength: 1 })),
        timezone: Type.Optional(Type.String({ minLength: 1 })),
        agentId: Type.Optional(
            Type.String({
                minLength: 1,
                description: "Optional target agent for webhook triggers."
            })
        ),
        parameters: Type.Optional(
            Type.Record(Type.String(), Type.Unknown(), {
                description: "Static parameter values stored on the trigger and injected on each execution."
            })
        )
    },
    { additionalProperties: false }
);

const taskTriggerRemoveSchema = Type.Object(
    {
        taskId: Type.String({ minLength: 1 }),
        type: Type.Union([Type.Literal("cron"), Type.Literal("webhook")])
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
        webhookTriggerId: Type.Optional(Type.String()),
        webhookPath: Type.Optional(Type.String()),
        deleted: Type.Optional(Type.Boolean()),
        removed: Type.Optional(Type.Boolean()),
        removedCount: Type.Optional(Type.Number()),
        success: Type.Optional(Type.Boolean()),
        output: Type.Optional(Type.String())
    },
    { additionalProperties: false }
);

type TaskResult = Static<typeof taskResultSchema>;

const APP_SERVER_DEFAULT_HOST = "127.0.0.1";
const APP_SERVER_DEFAULT_PORT = 7332;
const WEBHOOK_TOKEN_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 365 * 10;

const taskReturns: ToolResultContract<TaskResult> = {
    schema: taskResultSchema,
    toLLMText: (result) => result.summary
};

export function buildTaskCreateTool(): ToolDefinition {
    return {
        tool: {
            name: "task_create",
            description:
                "Create a reusable task with Python code. Use task_trigger_add to attach triggers afterwards. " +
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

            const paramPreamble = payload.parameters?.length
                ? taskParameterPreambleStubs(payload.parameters as TaskParameter[])
                : undefined;
            const verifyContext: Parameters<ToolDefinition["execute"]>[1] = {
                ...toolContext,
                agent: {
                    path: agentPathTask(toolContext.ctx.userId, "task"),
                    config: {
                        foreground: false,
                        name: null,
                        description: null,
                        systemPrompt: null,
                        workspaceDir: null
                    }
                } as unknown as Parameters<ToolDefinition["execute"]>[1]["agent"]
            };
            rlmVerify(payload.code, verifyContext, paramPreamble);

            const taskId = await taskIdGenerateFromTitle(storage, toolContext.ctx, payload.title);
            const now = Date.now();

            await storage.tasks.create({
                id: taskId,
                userId,
                title: payload.title,
                description: payload.description ?? null,
                code: payload.code,
                parameters: (payload.parameters as TaskParameter[]) ?? null,
                createdAt: now,
                updatedAt: now
            });
            await topographyObservationEmit(storage.observationLog, {
                userId,
                type: TOPO_EVENT_TYPES.TASK_CREATED,
                source: TOPO_SOURCE_TASKS,
                message: `Task created: ${payload.title}`,
                details: `Task ${taskId} created for user ${userId}: "${payload.title}"`,
                data: {
                    taskId,
                    userId,
                    title: payload.title,
                    description: payload.description ?? null
                },
                scopeIds: [userId]
            });

            const summary = `Created task ${taskId}.`;
            const typedResult: TaskResult = {
                summary,
                taskId
            };

            return {
                toolMessage: toolMessageBuild(toolCall.id, toolCall.name, summary, { taskId }),
                typedResult
            };
        }
    };
}

export function buildTaskReadTool(): ToolDefinition {
    return {
        tool: {
            name: "task_read",
            description: "Read a task and list its linked cron/webhook triggers.",
            parameters: taskReadSchema
        },
        returns: taskReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as TaskReadArgs;
            const task = await taskResolveForUser(toolContext, payload.taskId);
            const [cronTriggers, webhookTriggers] = await Promise.all([
                toolContext.agentSystem.crons.listTriggersForTask(toolContext.ctx, task.id),
                taskWebhooksResolve(toolContext).listTriggersForTask(toolContext.ctx, task.id)
            ]);
            const cronLines = cronTriggers.map(
                (trigger) => `  - ${trigger.id} (cron: ${trigger.schedule}, timezone: ${trigger.timezone})`
            );
            const webhookLines = await Promise.all(
                webhookTriggers.map(async (trigger) => {
                    const endpoint = await taskWebhookEndpointBuild(toolContext, trigger.id);
                    return `  - ${trigger.id} (webhook: ${endpoint}, agent: ${trigger.agentId ?? "system:webhook"})`;
                })
            );

            const parameterLines = task.parameters?.length
                ? task.parameters.map((p) => `  - ${p.name}: ${p.type}${p.nullable ? " (nullable)" : ""}`)
                : ["  - (none)"];
            const lines = [
                `Task ${task.id}: ${task.title}`,
                `Description: ${task.description ?? "(none)"}`,
                `Parameters: ${task.parameters?.length ?? 0}`,
                ...parameterLines,
                `Cron triggers: ${cronTriggers.length}`,
                ...(cronLines.length > 0 ? cronLines : ["  - (none)"]),
                `Webhook triggers: ${webhookTriggers.length}`,
                ...(webhookLines.length > 0 ? webhookLines : ["  - (none)"]),
                "",
                task.code
            ];
            const summary = lines.join("\n");

            return {
                toolMessage: toolMessageBuild(toolCall.id, toolCall.name, summary, {
                    task,
                    cronTriggers,
                    webhookTriggers
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
            description: "Update task title, Python code, description, or parameters.",
            parameters: taskUpdateSchema
        },
        returns: taskReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as TaskUpdateArgs;
            const task = await taskResolveForUser(toolContext, payload.taskId);
            if (
                payload.title === undefined &&
                payload.code === undefined &&
                payload.description === undefined &&
                payload.parameters === undefined
            ) {
                throw new Error("Provide at least one field to update: title, code, description, or parameters.");
            }

            const nextParams =
                payload.parameters !== undefined ? ((payload.parameters as TaskParameter[]) ?? null) : task.parameters;
            const nextCode = payload.code ?? task.code;

            // Re-verify code when code or parameters change
            if (payload.code || payload.parameters !== undefined) {
                const paramPreamble = nextParams?.length ? taskParameterPreambleStubs(nextParams) : undefined;

                // Verify against "task" context (always)
                const verifyContext: Parameters<ToolDefinition["execute"]>[1] = {
                    ...toolContext,
                    agent: {
                        path: agentPathTask(toolContext.ctx.userId, "task"),
                        config: {
                            foreground: false,
                            name: null,
                            description: null,
                            systemPrompt: null,
                            workspaceDir: null
                        }
                    } as unknown as Parameters<ToolDefinition["execute"]>[1]["agent"]
                };
                rlmVerify(nextCode, verifyContext, paramPreamble);

                // Validate existing trigger parameter values against the new schema
                if (nextParams?.length) {
                    const cronTriggers = await toolContext.agentSystem.crons.listTriggersForTask(
                        toolContext.ctx,
                        task.id
                    );
                    for (const trigger of cronTriggers) {
                        const error = taskParameterValidate(nextParams, trigger.parameters ?? {});
                        if (error) {
                            throw new Error(`Cron trigger ${trigger.id} has incompatible parameters: ${error}`);
                        }
                    }
                }
            }

            await toolContext.agentSystem.storage.tasks.update(toolContext.ctx, task.id, {
                title: payload.title ?? task.title,
                code: nextCode,
                description: payload.description === undefined ? task.description : payload.description,
                parameters: nextParams,
                updatedAt: Date.now()
            });
            const nextTitle = payload.title ?? task.title;
            const nextDescription = payload.description === undefined ? task.description : payload.description;
            const changes = taskChangesResolve({
                beforeTitle: task.title,
                beforeCode: task.code,
                beforeDescription: task.description,
                beforeParameters: task.parameters,
                afterTitle: nextTitle,
                afterCode: nextCode,
                afterDescription: nextDescription,
                afterParameters: nextParams
            });
            await topographyObservationEmit(toolContext.agentSystem.storage.observationLog, {
                userId: toolContext.ctx.userId,
                type: TOPO_EVENT_TYPES.TASK_UPDATED,
                source: TOPO_SOURCE_TASKS,
                message: `Task updated: ${nextTitle}`,
                details: `Task ${task.id} updated for user ${toolContext.ctx.userId}: "${nextTitle}"`,
                data: {
                    taskId: task.id,
                    userId: toolContext.ctx.userId,
                    title: nextTitle,
                    description: nextDescription,
                    changes
                },
                scopeIds: [toolContext.ctx.userId]
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
            description: "Delete a task and all linked cron/webhook triggers.",
            parameters: taskDeleteSchema
        },
        returns: taskReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as TaskDeleteArgs;
            const task = await taskResolveForUser(toolContext, payload.taskId);

            const [removedCron, removedWebhook] = await Promise.all([
                toolContext.agentSystem.crons.deleteTriggersForTask(toolContext.ctx, task.id),
                taskWebhooksResolve(toolContext).deleteTriggersForTask(toolContext.ctx, task.id)
            ]);
            const deletedDirect = await toolContext.agentSystem.storage.tasks.delete(toolContext.ctx, task.id);
            const deleted =
                deletedDirect ||
                (await toolContext.agentSystem.storage.tasks.findById(toolContext.ctx, task.id)) === null;
            if (deleted) {
                await topographyObservationEmit(toolContext.agentSystem.storage.observationLog, {
                    userId: toolContext.ctx.userId,
                    type: TOPO_EVENT_TYPES.TASK_DELETED,
                    source: TOPO_SOURCE_TASKS,
                    message: `Task deleted: ${task.title}`,
                    details: `Task ${task.id} deleted for user ${toolContext.ctx.userId}: "${task.title}"`,
                    data: {
                        taskId: task.id,
                        userId: toolContext.ctx.userId,
                        title: task.title
                    },
                    scopeIds: [toolContext.ctx.userId]
                });
            }
            const summary = deleted
                ? `Deleted task ${task.id} with ${removedCron} cron trigger(s) and ${removedWebhook} webhook trigger(s).`
                : `Task already removed: ${task.id}.`;

            return {
                toolMessage: toolMessageBuild(toolCall.id, toolCall.name, summary, {
                    taskId: task.id,
                    removedCron,
                    removedWebhook,
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
            description: "Execute a task's Python code immediately via the task agent or a specific agentId.",
            parameters: taskRunSchema
        },
        returns: taskReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as TaskRunArgs;
            const task = await taskResolveForUser(toolContext, payload.taskId);
            const target = payload.agentId
                ? { agentId: payload.agentId }
                : { path: agentPathTask(task.userId, task.id) };

            // Validate parameters and pass as native inputs
            let inputValues: Record<string, unknown> | undefined;
            if (payload.parameters && !task.parameters?.length) {
                throw new Error("Task has no parameter schema. Remove parameters or define a schema on the task.");
            }
            if (task.parameters?.length) {
                const values = payload.parameters ?? {};
                const error = taskParameterValidate(task.parameters, values);
                if (error) {
                    throw new Error(error);
                }
                inputValues = taskParameterInputsNormalize(task.parameters, values);
            }

            const text = ["[task]", `taskId: ${task.id}`, `taskTitle: ${task.title}`].join("\n");
            if (payload.sync !== true) {
                toolContext.agentSystem.taskExecutions.dispatch({
                    userId: task.userId,
                    source: "manual",
                    taskId: task.id,
                    taskVersion: task.version ?? null,
                    origin: "task",
                    target,
                    creationConfig: payload.agentId
                        ? undefined
                        : {
                              kind: "task",
                              name: task.title
                          },
                    text,
                    parameters: inputValues ?? undefined,
                    context: toolContext.messageContext
                });
                const summary = `Task ${task.id} queued.`;
                const typedResult: TaskResult = {
                    summary,
                    taskId: task.id
                };
                return {
                    toolMessage: toolMessageBuild(toolCall.id, toolCall.name, summary, {
                        taskId: task.id,
                        target
                    }),
                    typedResult
                };
            }

            const result = await toolContext.agentSystem.taskExecutions.dispatchAndAwait({
                userId: task.userId,
                source: "manual",
                taskId: task.id,
                taskVersion: task.version ?? null,
                origin: "task",
                target,
                creationConfig: payload.agentId
                    ? undefined
                    : {
                          kind: "task",
                          name: task.title
                      },
                text,
                parameters: inputValues ?? undefined,
                sync: true,
                context: toolContext.messageContext
            });

            const responseText = result.responseText ?? "";
            const success = !result.responseError;
            const summary = success ? `Task ${task.id} completed successfully.` : `Task ${task.id} execution failed.`;
            const typedResult: TaskResult = {
                summary,
                taskId: task.id,
                success,
                output: responseText
            };
            return {
                toolMessage: toolMessageBuild(toolCall.id, toolCall.name, summary, {
                    taskId: task.id,
                    success,
                    output: responseText
                }),
                typedResult
            };
        }
    };
}

export function buildTaskTriggerAddTool(): ToolDefinition {
    return {
        tool: {
            name: "task_trigger_add",
            description: "Attach a cron or webhook trigger to an existing task.",
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
                // Validate trigger parameters against task schema
                if (payload.parameters && !task.parameters?.length) {
                    throw new Error("Task has no parameter schema. Remove parameters or define a schema on the task.");
                }
                if (task.parameters?.length) {
                    const error = taskParameterValidate(
                        task.parameters,
                        (payload.parameters as Record<string, unknown>) ?? {}
                    );
                    if (error) {
                        throw new Error(error);
                    }
                }
                const ensured = await taskCronTriggerEnsure(
                    toolContext,
                    task.id,
                    payload.schedule,
                    undefined,
                    payload.timezone,
                    payload.parameters as Record<string, unknown> | undefined
                );
                const summary = ensured.duplicate
                    ? `Cron trigger for schedule ${payload.schedule.trim()} (${ensured.timezone}) already exists on task ${task.id} (${ensured.id}).`
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
                        timezone: ensured.timezone,
                        duplicate: ensured.duplicate
                    }),
                    typedResult
                };
            }

            if (payload.type === "webhook") {
                const ensured = await taskWebhookTriggerEnsure(toolContext, task.id, payload.agentId);
                const summary = ensured.duplicate
                    ? `Webhook trigger already exists on task ${task.id} (${ensured.id}, ${ensured.webhookPath}).`
                    : `Added webhook trigger ${ensured.id} to task ${task.id} (${ensured.webhookPath}).`;
                const typedResult: TaskResult = {
                    summary,
                    taskId: task.id,
                    webhookTriggerId: ensured.id,
                    webhookPath: ensured.webhookPath
                };
                return {
                    toolMessage: toolMessageBuild(toolCall.id, toolCall.name, summary, {
                        taskId: task.id,
                        webhookTriggerId: ensured.id,
                        webhookPath: ensured.webhookPath,
                        duplicate: ensured.duplicate
                    }),
                    typedResult
                };
            }

            throw new Error(`Unsupported trigger type: ${payload.type}`);
        }
    };
}

export function buildTaskTriggerRemoveTool(): ToolDefinition {
    return {
        tool: {
            name: "task_trigger_remove",
            description: "Remove a cron or webhook trigger from a task.",
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

            if (payload.type === "webhook") {
                const removedCount = await taskWebhooksResolve(toolContext).deleteTriggersForTask(
                    toolContext.ctx,
                    task.id
                );
                const removed = removedCount > 0;
                const summary = removed
                    ? `Removed ${removedCount} webhook trigger(s) from task ${task.id}.`
                    : `No webhook trigger found for task ${task.id}.`;
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

            throw new Error(`Unsupported trigger type: ${payload.type}`);
        }
    };
}

async function taskResolveForUser(
    toolContext: Parameters<ToolDefinition["execute"]>[1],
    taskId: string
): Promise<{
    id: string;
    userId: string;
    version?: number;
    title: string;
    description: string | null;
    code: string;
    parameters: TaskParameter[] | null;
}> {
    const normalizedTaskId = taskId.trim();
    if (!taskIdIsSafe(normalizedTaskId)) {
        throw new Error("Task id contains invalid characters.");
    }
    const task = await toolContext.agentSystem.storage.tasks.findById(toolContext.ctx, normalizedTaskId);
    if (!task) {
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
    ctx: Parameters<ToolDefinition["execute"]>[1]["ctx"],
    title: string
): Promise<string> {
    const base = stringSlugify(title) || "task";
    let candidate = base;
    let suffix = 2;

    while (await storage.tasks.findAnyById(ctx, candidate)) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
    }

    return candidate;
}

function taskChangesResolve(input: {
    beforeTitle: string;
    beforeCode: string;
    beforeDescription: string | null;
    beforeParameters: TaskParameter[] | null;
    afterTitle: string;
    afterCode: string;
    afterDescription: string | null;
    afterParameters: TaskParameter[] | null;
}): string[] {
    const changes: string[] = [];
    if (input.beforeTitle !== input.afterTitle) {
        changes.push("title");
    }
    if (input.beforeCode !== input.afterCode) {
        changes.push("code");
    }
    if (input.beforeDescription !== input.afterDescription) {
        changes.push("description");
    }
    if (JSON.stringify(input.beforeParameters) !== JSON.stringify(input.afterParameters)) {
        changes.push("parameters");
    }
    return changes;
}

async function taskCronTriggerEnsure(
    toolContext: Parameters<ToolDefinition["execute"]>[1],
    taskId: string,
    schedule: string,
    agentId?: string,
    timezone?: string,
    parameters?: Record<string, unknown>
): Promise<{ id: string; duplicate: boolean; timezone: string }> {
    const normalizedSchedule = schedule.trim();
    if (!cronExpressionParse(normalizedSchedule)) {
        throw new Error(`Invalid cron schedule: ${schedule}`);
    }
    const normalizedTimezone = await taskCronTimezoneResolve(toolContext, timezone);

    const existing = await toolContext.agentSystem.crons.listTriggersForTask(toolContext.ctx, taskId);
    const duplicate = existing.find(
        (trigger) => trigger.schedule === normalizedSchedule && trigger.timezone === normalizedTimezone
    );
    if (duplicate) {
        return { id: duplicate.id, duplicate: true, timezone: normalizedTimezone };
    }

    const created = await toolContext.agentSystem.crons.addTrigger(toolContext.ctx, {
        taskId,
        schedule: normalizedSchedule,
        timezone: normalizedTimezone,
        agentId,
        parameters
    });
    return { id: created.id, duplicate: false, timezone: normalizedTimezone };
}

async function taskWebhookTriggerEnsure(
    toolContext: Parameters<ToolDefinition["execute"]>[1],
    taskId: string,
    agentId?: string
): Promise<{ id: string; duplicate: boolean; webhookPath: string }> {
    const normalizedAgentId = agentId?.trim() || null;
    const existing = await taskWebhooksResolve(toolContext).listTriggersForTask(toolContext.ctx, taskId);
    const duplicate = existing.find((trigger) => (trigger.agentId ?? null) === normalizedAgentId);
    if (duplicate) {
        return {
            id: duplicate.id,
            duplicate: true,
            webhookPath: await taskWebhookEndpointBuild(toolContext, duplicate.id)
        };
    }

    const created = await taskWebhooksResolve(toolContext).addTrigger(toolContext.ctx, {
        taskId,
        ...(normalizedAgentId ? { agentId: normalizedAgentId } : {})
    });
    return {
        id: created.id,
        duplicate: false,
        webhookPath: await taskWebhookEndpointBuild(toolContext, created.id)
    };
}

async function taskWebhookEndpointBuild(
    toolContext: Parameters<ToolDefinition["execute"]>[1],
    triggerId: string
): Promise<string> {
    const origin = taskWebhookOriginResolve(toolContext);
    const token = await taskWebhookTokenSign(toolContext, triggerId);
    return `${origin}/v1/webhooks/${token}`;
}

async function taskWebhookTokenSign(
    toolContext: Parameters<ToolDefinition["execute"]>[1],
    triggerId: string
): Promise<string> {
    const secret = await taskWebhookSecretResolve(toolContext);
    return jwtSign(
        {
            userId: triggerId
        },
        secret,
        WEBHOOK_TOKEN_EXPIRES_IN_SECONDS,
        {
            service: JWT_SERVICE_WEBHOOK
        }
    );
}

function taskWebhookOriginResolve(toolContext: Parameters<ToolDefinition["execute"]>[1]): string {
    const settings = toolContext.agentSystem.config?.current.settings.appServer;
    const serverEndpoint = taskWebhookServerEndpointResolve(settings?.serverEndpoint);
    if (serverEndpoint) {
        return serverEndpoint;
    }
    return taskWebhookHostPortOriginBuild(settings?.host, settings?.port);
}

async function taskWebhookSecretResolve(toolContext: Parameters<ToolDefinition["execute"]>[1]): Promise<string> {
    const appServer = toolContext.agentSystem.config?.current.settings.appServer;
    const settingsJwtSecret = taskWebhookJwtSecretResolve(appServer?.jwtSecret);
    return appJwtSecretResolve(settingsJwtSecret, toolContext.auth);
}

function taskWebhookJwtSecretResolve(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function taskWebhookServerEndpointResolve(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return null;
        }
        if (parsed.search || parsed.hash) {
            return null;
        }
        if (parsed.pathname.replace(/\/+$/, "").length > 0) {
            return null;
        }
        return `${parsed.protocol}//${parsed.host}`;
    } catch {
        return null;
    }
}

function taskWebhookHostPortOriginBuild(hostValue: unknown, portValue: unknown): string {
    const host = taskWebhookHostResolve(hostValue);
    const port = taskWebhookPortResolve(portValue);
    const formattedHost = host.includes(":") && !host.startsWith("[") && !host.endsWith("]") ? `[${host}]` : host;
    return `http://${formattedHost}:${port}`;
}

function taskWebhookHostResolve(value: unknown): string {
    if (typeof value !== "string") {
        return APP_SERVER_DEFAULT_HOST;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : APP_SERVER_DEFAULT_HOST;
}

function taskWebhookPortResolve(value: unknown): number {
    if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 65535) {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number.parseInt(value.trim(), 10);
        if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535) {
            return parsed;
        }
    }
    return APP_SERVER_DEFAULT_PORT;
}

function taskWebhooksResolve(
    toolContext: Parameters<ToolDefinition["execute"]>[1]
): NonNullable<Parameters<ToolDefinition["execute"]>[1]["webhooks"]> {
    if (toolContext.webhooks) {
        return toolContext.webhooks;
    }
    return toolContext.agentSystem.webhooks;
}

async function taskCronTimezoneResolve(
    toolContext: Parameters<ToolDefinition["execute"]>[1],
    timezone?: string
): Promise<string> {
    const user = await toolContext.agentSystem.storage.users.findById(toolContext.ctx.userId);
    return cronTimezoneResolve({
        timezone,
        profileTimezone: user?.timezone,
        requireResolved: true
    });
}
