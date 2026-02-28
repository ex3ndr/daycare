/**
 * Central type definitions for the heartbeat module.
 */

import type { HeartbeatTaskDbRecord } from "../../storage/databaseTypes.js";
import type { HeartbeatTasksRepository } from "../../storage/heartbeatTasksRepository.js";
import type { TasksRepository } from "../../storage/tasksRepository.js";
import type { ConfigModule } from "../config/configModule.js";

export type HeartbeatDefinition = HeartbeatTaskDbRecord;
export type HeartbeatRunTask = HeartbeatDefinition & { code: string; inputs?: Record<string, unknown> };

export type HeartbeatSchedulerOptions = {
    config: ConfigModule;
    repository: HeartbeatTasksRepository;
    tasksRepository: TasksRepository;
    intervalMs?: number;
    onRun: (tasks: HeartbeatRunTask[], runAt: Date) => void | Promise<void>;
    onError?: (error: unknown, taskIds?: string[]) => void | Promise<void>;
    onTaskComplete?: (task: HeartbeatDefinition, runAt: Date) => void | Promise<void>;
};

export type HeartbeatCreateTaskArgs = {
    id?: string;
    taskId: string;
    overwrite?: boolean;
    parameters?: Record<string, unknown>;
};
