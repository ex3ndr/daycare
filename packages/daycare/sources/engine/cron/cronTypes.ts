import type { CronTaskDbRecord } from "../../storage/databaseTypes.js";
import type { TaskParameter } from "../modules/tasks/taskParameterTypes.js";

/**
 * Cron task definition as stored/provided by the user.
 */
export type CronTaskDefinition = {
    id: string;
    taskId: string;
    schedule: string;
    timezone?: string;
    agentId?: string;
    userId: string;
    enabled?: boolean;
    deleteAfterRun?: boolean;
    parameters?: Record<string, unknown>;
};

/**
 * Context passed to task handlers when a cron task executes.
 */
export type CronTaskContext = {
    triggerId: string;
    taskId: string;
    taskVersion?: number;
    taskName: string;
    timezone: string;
    agentId: string | null;
    userId: string;
    parameters?: Record<string, unknown>;
    inputs?: Record<string, unknown>;
    inputSchema?: TaskParameter[];
};

/**
 * Snapshot information about a scheduled cron trigger.
 */
export type CronTaskInfo = {
    triggerId: string;
    taskId: string;
    taskName: string;
    timezone: string;
    agentId: string | null;
    userId: string;
};

/**
 * A single field from a parsed cron expression.
 */
export type CronField = {
    values: Set<number>;
    any: boolean;
};

/**
 * Parsed 5-field cron expression.
 */
export type ParsedCron = {
    minute: CronField;
    hour: CronField;
    day: CronField;
    month: CronField;
    weekday: CronField;
};

/**
 * Internal tracking for a scheduled task in the scheduler.
 */
export type ScheduledTask = {
    task: CronTaskDbRecord;
    nextRun: Date;
    timer: NodeJS.Timeout | null;
};
