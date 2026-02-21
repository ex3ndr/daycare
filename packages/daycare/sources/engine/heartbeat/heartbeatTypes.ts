/**
 * Central type definitions for the heartbeat module.
 */

import type { SessionPermissions } from "@/types";
import type { HeartbeatTaskDbRecord } from "../../storage/databaseTypes.js";
import type { HeartbeatTasksRepository } from "../../storage/heartbeatTasksRepository.js";
import type { ConfigModule } from "../config/configModule.js";
import type { ExecGateCheckInput, ExecGateCheckResult } from "../scheduling/execGateCheck.js";

export type HeartbeatDefinition = HeartbeatTaskDbRecord;

export type HeartbeatSchedulerOptions = {
    config: ConfigModule;
    repository: HeartbeatTasksRepository;
    intervalMs?: number;
    resolveDefaultPermissions: () => Promise<SessionPermissions> | SessionPermissions;
    onRun: (tasks: HeartbeatDefinition[], runAt: Date) => void | Promise<void>;
    onError?: (error: unknown, taskIds?: string[]) => void | Promise<void>;
    onTaskComplete?: (task: HeartbeatDefinition, runAt: Date) => void | Promise<void>;
    gateCheck?: (input: ExecGateCheckInput) => Promise<ExecGateCheckResult>;
};

export type HeartbeatCreateTaskArgs = {
    id?: string;
    title: string;
    prompt: string;
    gate?: HeartbeatDefinition["gate"];
    overwrite?: boolean;
};
