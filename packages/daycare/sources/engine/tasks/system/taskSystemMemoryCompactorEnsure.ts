import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import matter from "gray-matter";
import type { Storage } from "../../../storage/storage.js";
import type { AgentSystem } from "../../agents/agentSystem.js";
import { contextForUser } from "../../agents/context.js";
import { agentPathCompactor, agentPathCron } from "../../agents/ops/agentPathBuild.js";
import type { TaskParameter } from "../../modules/tasks/taskParameterTypes.js";
import { taskSystemIdIs } from "./taskSystemIdIs.js";

const MEMORY_COMPACTOR_TASK_ID = "system:memory-compactor";
const MEMORY_COMPACTOR_CRON_SUFFIX = "memory-compactor";
const MEMORY_COMPACTOR_CRON_SLUG = "memory-compactor";
const MEMORY_COMPACTOR_SCHEDULE = "0 */12 * * *";
const MEMORY_COMPACTOR_TIMEZONE = "UTC";

type SystemTaskFrontmatter = {
    title?: string;
    description?: string;
    parameters?: TaskParameter[];
};

/**
 * Ensures the persisted memory-compactor system task and its cron trigger exist for users with memory enabled.
 * Expects: migrations are applied and agentSystem.load() already completed.
 */
export async function taskSystemMemoryCompactorEnsure(storage: Storage, agentSystem: AgentSystem): Promise<void> {
    const users = await storage.users.findMany();
    const taskDefinition = await taskDefinitionRead();

    for (const user of users) {
        const ctx = contextForUser({ userId: user.id });
        const triggerId = memoryCompactorTriggerIdBuild(user.id);
        const existingTrigger = await storage.cronTasks.findById(triggerId);

        if (!userMemoryEnabled(user)) {
            if (existingTrigger?.enabled) {
                await storage.cronTasks.update(existingTrigger.id, {
                    enabled: false,
                    updatedAt: Date.now()
                });
            }
            continue;
        }

        const compactorAgentId = await agentSystem.agentIdForTarget(
            ctx,
            { path: agentPathCompactor(agentPathCron(user.id, MEMORY_COMPACTOR_CRON_SLUG)) },
            {
                kind: "compactor",
                foreground: false,
                name: "memory-compactor",
                description: "Compacts memory documents and updates memory role prompts."
            }
        );

        const existingTask = await storage.tasks.findById(ctx, MEMORY_COMPACTOR_TASK_ID);
        if (!existingTask) {
            const now = Date.now();
            await storage.tasks.create({
                id: MEMORY_COMPACTOR_TASK_ID,
                userId: user.id,
                title: taskDefinition.title,
                description: taskDefinition.description,
                code: taskDefinition.code,
                parameters: taskDefinition.parameters,
                createdAt: now,
                updatedAt: now
            });
        } else if (taskNeedsUpdate(existingTask, taskDefinition)) {
            await storage.tasks.update(ctx, MEMORY_COMPACTOR_TASK_ID, {
                title: taskDefinition.title,
                description: taskDefinition.description,
                code: taskDefinition.code,
                parameters: taskDefinition.parameters,
                updatedAt: Date.now()
            });
        }

        if (!existingTrigger) {
            const now = Date.now();
            await storage.cronTasks.create({
                id: triggerId,
                taskId: MEMORY_COMPACTOR_TASK_ID,
                userId: user.id,
                schedule: MEMORY_COMPACTOR_SCHEDULE,
                timezone: MEMORY_COMPACTOR_TIMEZONE,
                agentId: compactorAgentId,
                enabled: true,
                deleteAfterRun: false,
                parameters: null,
                lastRunAt: null,
                createdAt: now,
                updatedAt: now
            });
            continue;
        }

        const nextEnabled = existingTrigger.enabled;
        if (
            existingTrigger.taskId !== MEMORY_COMPACTOR_TASK_ID ||
            existingTrigger.schedule !== MEMORY_COMPACTOR_SCHEDULE ||
            existingTrigger.timezone !== MEMORY_COMPACTOR_TIMEZONE ||
            existingTrigger.agentId !== compactorAgentId
        ) {
            await storage.cronTasks.create({
                ...existingTrigger,
                taskId: MEMORY_COMPACTOR_TASK_ID,
                userId: user.id,
                schedule: MEMORY_COMPACTOR_SCHEDULE,
                timezone: MEMORY_COMPACTOR_TIMEZONE,
                agentId: compactorAgentId,
                enabled: nextEnabled,
                deleteAfterRun: false,
                parameters: null,
                updatedAt: Date.now()
            });
        }
    }
}

function taskNeedsUpdate(
    task: {
        id: string;
        title: string;
        description: string | null;
        code: string;
        parameters: TaskParameter[] | null;
    },
    definition: { title: string; description: string | null; code: string; parameters: TaskParameter[] | null }
): boolean {
    if (!taskSystemIdIs(task.id)) {
        return false;
    }
    return (
        task.title !== definition.title ||
        task.description !== definition.description ||
        task.code !== definition.code ||
        JSON.stringify(task.parameters ?? null) !== JSON.stringify(definition.parameters ?? null)
    );
}

function userMemoryEnabled(user: { isWorkspace: boolean; memory: boolean }): boolean {
    return !user.isWorkspace || user.memory;
}

function memoryCompactorTriggerIdBuild(userId: string): string {
    return `system:${userId}:${MEMORY_COMPACTOR_CRON_SUFFIX}`;
}

async function taskDefinitionRead(): Promise<{
    title: string;
    description: string | null;
    code: string;
    parameters: TaskParameter[] | null;
}> {
    const taskDir = path.resolve(systemTasksRootResolve(), "memory-compactor");
    const descriptionPath = path.join(taskDir, "description.md");
    const codePath = path.join(taskDir, "task.py");
    const [descriptionSource, code] = await Promise.all([
        fs.readFile(descriptionPath, "utf8"),
        fs.readFile(codePath, "utf8")
    ]);
    const parsed = matter(descriptionSource);
    const metadata = parsed.data as SystemTaskFrontmatter;
    const title = metadata.title?.trim();
    if (!title) {
        throw new Error("System task title is required for memory compactor.");
    }
    return {
        title,
        description: parsed.content.trim() || metadata.description?.trim() || null,
        code,
        parameters: metadata.parameters ?? null
    };
}

function systemTasksRootResolve(): string {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../system-tasks");
}
