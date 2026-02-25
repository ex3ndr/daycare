/**
 * Central type definitions for the heartbeat module.
 */

import type { HeartbeatTaskDbRecord } from "../../storage/databaseTypes.js";
import type { HeartbeatTasksRepository } from "../../storage/heartbeatTasksRepository.js";
import type { ConfigModule } from "../config/configModule.js";

export type HeartbeatDefinition = HeartbeatTaskDbRecord;

export type HeartbeatSchedulerOptions = {
    config: ConfigModule;
    repository: HeartbeatTasksRepository;
    intervalMs?: number;
    onRun: (tasks: HeartbeatDefinition[], runAt: Date) => void | Promise<void>;
    onError?: (error: unknown, taskIds?: string[]) => void | Promise<void>;
    onTaskComplete?: (task: HeartbeatDefinition, runAt: Date) => void | Promise<void>;
};

export type HeartbeatCreateTaskArgs = {
    id?: string;
    title: string;
    code: string;
    overwrite?: boolean;
};
