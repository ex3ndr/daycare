import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { appJwtSecretResolve } from "../../../plugins/daycare-app-server/appJwtSecretResolve.js";
import type { PluginInstanceSettings } from "../../../settings.js";
import { jwtSign } from "../../../util/jwt.js";
import { stringSlugify } from "../../../utils/stringSlugify.js";
import { taskIdIsSafe } from "../../../utils/taskIdIsSafe.js";
import { contextForAgent, contextForUser } from "../../agents/context.js";
import { cronExpressionParse } from "../../cron/ops/cronExpressionParse.js";
import { cronTimezoneResolve } from "../../cron/ops/cronTimezoneResolve.js";
import { rlmVerify } from "../rlm/rlmVerify.js";

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
        cronTimezone: Type.Optional(
            Type.String({
                minLength: 1,
                description: "IANA timezone for cron (for example America/New_York). Defaults to profile timezone."
            })
        ),
        heartbeat: Type.Optional(Type.Boolean({ description: "Attach a heartbeat trigger (~30 min interval)." })),
        webhook: Type.Optional(
            Type.Boolean({ description: "Attach a webhook trigger that runs on POST /v1/webhooks/<token>." })
        ),
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
        type: Type.Union([Type.Literal("cron"), Type.Literal("heartbeat"), Type.Literal("webhook")]),
        schedule: Type.Optional(Type.String({ minLength: 1 })),
        timezone: Type.Optional(Type.String({ minLength: 1 })),
        agentId: Type.Optional(
            Type.String({
                minLength: 1,
                description: "Optional target agent for webhook triggers."
            })
        )
    },
    { additionalProperties: false }
);

const taskTriggerRemoveSchema = Type.Object(
    {
        taskId: Type.String({ minLength: 1 }),
        type: Type.Union([Type.Literal("cron"), Type.Literal("heartbeat"), Type.Literal("webhook")])
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
        webhookTriggerId: Type.Optional(Type.String()),
        webhookPath: Type.Optional(Type.String()),
        deleted: Type.Optional(Type.Boolean()),
        removed: Type.Optional(Type.Boolean()),
        removedCount: Type.Optional(Type.Number())
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
                "Create a reusable task with Python code and optionally attach cron/heartbeat/webhook triggers. " +
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

            const verifyContexts = await taskVerifyContextsResolve(toolContext, payload);
            for (const verifyContext of verifyContexts) {
                rlmVerify(payload.code, verifyContext);
            }

            if (payload.cron && !cronExpressionParse(payload.cron)) {
                throw new Error(`Invalid cron schedule: ${payload.cron}`);
            }

            const taskId = await taskIdGenerateFromTitle(storage, toolContext.ctx, payload.title);
            const now = Date.now();

            let cronTrigger: { id: string; duplicate: boolean } | null = null;
            let heartbeatTrigger: { id: string; duplicate: boolean } | null = null;
            let webhookTrigger: { id: string; duplicate: boolean; webhookPath: string } | null = null;

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
                    cronTrigger = await taskCronTriggerEnsure(
                        toolContext,
                        taskId,
                        payload.cron,
                        payload.agentId,
                        payload.cronTimezone
                    );
                }

                if (payload.heartbeat === true) {
                    heartbeatTrigger = await taskHeartbeatTriggerEnsure(toolContext, taskId);
                }

                if (payload.webhook === true) {
                    webhookTrigger = await taskWebhookTriggerEnsure(toolContext, taskId, payload.agentId);
                }
            } catch (error) {
                if (cronTrigger && !cronTrigger.duplicate) {
                    await toolContext.agentSystem.crons.deleteTask(toolContext.ctx, cronTrigger.id).catch(() => {});
                }
                if (heartbeatTrigger && !heartbeatTrigger.duplicate) {
                    await toolContext.heartbeats.removeTask(toolContext.ctx, heartbeatTrigger.id).catch(() => {});
                }
                if (webhookTrigger && !webhookTrigger.duplicate) {
                    await taskWebhooksResolve(toolContext)
                        .deleteTrigger(toolContext.ctx, webhookTrigger.id)
                        .catch(() => {});
                }
                await storage.tasks.delete(toolContext.ctx, taskId).catch(() => {});
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
            if (webhookTrigger) {
                summaryParts.push(
                    webhookTrigger.duplicate
                        ? `Using existing webhook trigger ${webhookTrigger.id} (${webhookTrigger.webhookPath}).`
                        : `Added webhook trigger ${webhookTrigger.id} (${webhookTrigger.webhookPath}).`
                );
            }
            const summary = summaryParts.join(" ");
            const typedResult: TaskResult = {
                summary,
                taskId,
                ...(cronTrigger ? { cronTriggerId: cronTrigger.id } : {}),
                ...(heartbeatTrigger ? { heartbeatTriggerId: heartbeatTrigger.id } : {}),
                ...(webhookTrigger
                    ? {
                          webhookTriggerId: webhookTrigger.id,
                          webhookPath: webhookTrigger.webhookPath
                      }
                    : {})
            };

            return {
                toolMessage: toolMessageBuild(toolCall.id, toolCall.name, summary, {
                    taskId,
                    cronTriggerId: cronTrigger?.id ?? null,
                    cronTriggerDuplicate: cronTrigger?.duplicate ?? false,
                    heartbeatTriggerId: heartbeatTrigger?.id ?? null,
                    heartbeatTriggerDuplicate: heartbeatTrigger?.duplicate ?? false,
                    webhookTriggerId: webhookTrigger?.id ?? null,
                    webhookTriggerDuplicate: webhookTrigger?.duplicate ?? false,
                    webhookPath: webhookTrigger?.webhookPath ?? null
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
            description: "Read a task and list its linked cron/heartbeat/webhook triggers.",
            parameters: taskReadSchema
        },
        returns: taskReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as TaskReadArgs;
            const task = await taskResolveForUser(toolContext, payload.taskId);
            const [cronTriggers, heartbeatTriggers, webhookTriggers] = await Promise.all([
                toolContext.agentSystem.crons.listTriggersForTask(toolContext.ctx, task.id),
                toolContext.heartbeats.listTriggersForTask(toolContext.ctx, task.id),
                taskWebhooksResolve(toolContext).listTriggersForTask(toolContext.ctx, task.id)
            ]);
            const cronLines = cronTriggers.map(
                (trigger) => `  - ${trigger.id} (cron: ${trigger.schedule}, timezone: ${trigger.timezone})`
            );
            const heartbeatLines = heartbeatTriggers.map((trigger) => `  - ${trigger.id} (heartbeat)`);
            const webhookLines = await Promise.all(
                webhookTriggers.map(async (trigger) => {
                    const endpoint = await taskWebhookEndpointBuild(toolContext, trigger.id);
                    return `  - ${trigger.id} (webhook: ${endpoint}, agent: ${trigger.agentId ?? "system:webhook"})`;
                })
            );

            const lines = [
                `Task ${task.id}: ${task.title}`,
                `Description: ${task.description ?? "(none)"}`,
                `Cron triggers: ${cronTriggers.length}`,
                ...(cronLines.length > 0 ? cronLines : ["  - (none)"]),
                `Heartbeat triggers: ${heartbeatTriggers.length}`,
                ...(heartbeatLines.length > 0 ? heartbeatLines : ["  - (none)"]),
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
                    heartbeatTriggers,
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

            await toolContext.agentSystem.storage.tasks.update(toolContext.ctx, task.id, {
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
            description: "Delete a task and all linked cron/heartbeat/webhook triggers.",
            parameters: taskDeleteSchema
        },
        returns: taskReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as TaskDeleteArgs;
            const task = await taskResolveForUser(toolContext, payload.taskId);

            const [removedCron, removedHeartbeat, removedWebhook] = await Promise.all([
                toolContext.agentSystem.crons.deleteTriggersForTask(toolContext.ctx, task.id),
                toolContext.heartbeats.deleteTriggersForTask(toolContext.ctx, task.id),
                taskWebhooksResolve(toolContext).deleteTriggersForTask(toolContext.ctx, task.id)
            ]);
            const deletedDirect = await toolContext.agentSystem.storage.tasks.delete(toolContext.ctx, task.id);
            const deleted =
                deletedDirect ||
                (await toolContext.agentSystem.storage.tasks.findById(toolContext.ctx, task.id)) === null;
            const summary = deleted
                ? `Deleted task ${task.id} with ${removedCron} cron trigger(s), ${removedHeartbeat} heartbeat trigger(s), and ${removedWebhook} webhook trigger(s).`
                : `Task already removed: ${task.id}.`;

            return {
                toolMessage: toolMessageBuild(toolCall.id, toolCall.name, summary, {
                    taskId: task.id,
                    removedCron,
                    removedHeartbeat,
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
            description: "Attach a cron, heartbeat, or webhook trigger to an existing task.",
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
                const ensured = await taskCronTriggerEnsure(
                    toolContext,
                    task.id,
                    payload.schedule,
                    undefined,
                    payload.timezone
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
            description: "Remove a cron, heartbeat, or webhook trigger from a task.",
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
    const task = await toolContext.agentSystem.storage.tasks.findById(toolContext.ctx, normalizedTaskId);
    if (!task) {
        throw new Error(`Task not found: ${normalizedTaskId}`);
    }
    return task;
}

async function taskVerifyContextsResolve(
    toolContext: Parameters<ToolDefinition["execute"]>[1],
    payload: TaskCreateArgs
): Promise<Array<Parameters<ToolDefinition["execute"]>[1]>> {
    if (payload.agentId) {
        return [await taskVerifyContextForAgentResolve(toolContext, payload.agentId)];
    }

    const tags = new Set<"task" | "cron" | "heartbeat" | "webhook">();
    if (!payload.cron && payload.heartbeat !== true && payload.webhook !== true) {
        tags.add("task");
    }
    if (payload.cron) {
        tags.add("cron");
    }
    if (payload.heartbeat === true) {
        tags.add("heartbeat");
    }
    if (payload.webhook === true) {
        tags.add("webhook");
    }

    return [...tags].map((tag) => {
        return {
            ...toolContext,
            agent: {
                descriptor: { type: "system", tag }
            } as unknown as Parameters<ToolDefinition["execute"]>[1]["agent"]
        };
    });
}

async function taskVerifyContextForAgentResolve(
    toolContext: Parameters<ToolDefinition["execute"]>[1],
    agentId: string
): Promise<Parameters<ToolDefinition["execute"]>[1]> {
    const normalizedAgentId = agentId.trim();
    if (!normalizedAgentId) {
        throw new Error("agentId is required when routing task verification.");
    }
    if (toolContext.ctx.hasAgentId && toolContext.ctx.agentId === normalizedAgentId) {
        return toolContext;
    }

    const targetAgent = await toolContext.agentSystem.storage.agents.findById(normalizedAgentId);
    if (!targetAgent || targetAgent.userId !== toolContext.ctx.userId) {
        throw new Error(`Target agent not found: ${normalizedAgentId}`);
    }

    return {
        ...toolContext,
        ctx: contextForAgent({
            userId: toolContext.ctx.userId,
            agentId: normalizedAgentId
        }),
        agent: {
            descriptor: targetAgent.descriptor
        } as unknown as Parameters<ToolDefinition["execute"]>[1]["agent"]
    };
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

async function taskCronTriggerEnsure(
    toolContext: Parameters<ToolDefinition["execute"]>[1],
    taskId: string,
    schedule: string,
    agentId?: string,
    timezone?: string
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
        agentId
    });
    return { id: created.id, duplicate: false, timezone: normalizedTimezone };
}

async function taskHeartbeatTriggerEnsure(
    toolContext: Parameters<ToolDefinition["execute"]>[1],
    taskId: string
): Promise<{ id: string; duplicate: boolean }> {
    const existing = await toolContext.heartbeats.listTriggersForTask(toolContext.ctx, taskId);
    if (existing.length > 0) {
        return { id: existing[0]!.id, duplicate: true };
    }

    const created = await toolContext.heartbeats.addTrigger(toolContext.ctx, { taskId });
    return { id: created.id, duplicate: false };
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
        WEBHOOK_TOKEN_EXPIRES_IN_SECONDS
    );
}

function taskWebhookOriginResolve(toolContext: Parameters<ToolDefinition["execute"]>[1]): string {
    const plugins = toolContext.agentSystem.config?.current.settings.plugins ?? [];
    const appServer =
        plugins.find(
            (plugin) =>
                plugin.pluginId === "daycare-app-server" &&
                plugin.instanceId === "daycare-app-server" &&
                plugin.enabled !== false
        ) ?? plugins.find((plugin) => plugin.pluginId === "daycare-app-server" && plugin.enabled !== false);
    const settings = taskAppServerSettingsResolve(appServer);
    const serverEndpoint = taskWebhookServerEndpointResolve(settings.serverEndpoint);
    if (serverEndpoint) {
        return serverEndpoint;
    }
    return taskWebhookHostPortOriginBuild(settings.host, settings.port);
}

function taskAppServerSettingsResolve(plugin: PluginInstanceSettings | undefined): {
    host: unknown;
    port: unknown;
    serverEndpoint: unknown;
    jwtSecret: unknown;
} {
    if (!plugin?.settings || typeof plugin.settings !== "object") {
        return {
            host: undefined,
            port: undefined,
            serverEndpoint: undefined,
            jwtSecret: undefined
        };
    }
    return {
        host: plugin.settings.host,
        port: plugin.settings.port,
        serverEndpoint: plugin.settings.serverEndpoint,
        jwtSecret: plugin.settings.jwtSecret
    };
}

async function taskWebhookSecretResolve(toolContext: Parameters<ToolDefinition["execute"]>[1]): Promise<string> {
    const plugins = toolContext.agentSystem.config?.current.settings.plugins ?? [];
    const appServer =
        plugins.find(
            (plugin) =>
                plugin.pluginId === "daycare-app-server" &&
                plugin.instanceId === "daycare-app-server" &&
                plugin.enabled !== false
        ) ?? plugins.find((plugin) => plugin.pluginId === "daycare-app-server" && plugin.enabled !== false);
    const settings = taskAppServerSettingsResolve(appServer);
    const settingsJwtSecret = taskWebhookJwtSecretResolve(settings.jwtSecret);
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
