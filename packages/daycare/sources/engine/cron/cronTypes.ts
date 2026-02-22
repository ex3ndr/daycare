import type { CronTaskDbRecord } from "../../storage/databaseTypes.js";

/**
 * Cron task definition as stored/provided by the user.
 */
export type CronTaskDefinition = {
    id: string;
    taskUid?: string;
    name: string;
    description?: string;
    schedule: string;
    prompt: string;
    agentId?: string;
    userId: string;
    enabled?: boolean;
    deleteAfterRun?: boolean;
};

/**
 * Cron task with computed paths for file storage.
 */
/**
 * Context passed to task handlers when a cron task executes.
 */
export type CronTaskContext = {
    taskId: string;
    taskUid: string;
    taskName: string;
    prompt: string;
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
