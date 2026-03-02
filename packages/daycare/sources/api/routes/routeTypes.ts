import type { AgentHistoryRecord, AgentInboxItem, AgentLifecycleState, AgentPostTarget, Context } from "@/types";
import type { TaskParameter } from "../../engine/modules/tasks/taskParameterTypes.js";
import type {
    CronTaskDbRecord,
    TaskDbRecord,
    TokenStatsHourlyDbRecord,
    WebhookTaskDbRecord
} from "../../storage/databaseTypes.js";
import type { TokenStatsFetchOptions } from "./costs/costsRoutes.js";

export type AgentListItem = {
    agentId: string;
    lifecycle: AgentLifecycleState;
    updatedAt: number;
    userId?: string;
};

export type TaskCreateInput = {
    title: string;
    code: string;
    description?: string | null;
    parameters?: TaskParameter[] | null;
};

export type TaskUpdateInput = {
    title?: string;
    code?: string;
    description?: string | null;
    parameters?: TaskParameter[] | null;
};

export type TaskRunInput = {
    agentId?: string;
    parameters?: Record<string, unknown>;
    sync?: boolean;
};

export type TaskRunResult =
    | {
          queued: true;
      }
    | {
          output: string;
      };

export type CronTriggerAddInput = {
    schedule: string;
    timezone?: string;
    agentId?: string;
    parameters?: Record<string, unknown>;
};

export type WebhookTriggerAddInput = {
    agentId?: string;
};

export type TaskRecordWithTriggers = {
    task: TaskDbRecord;
    triggers: {
        cron: CronTaskDbRecord[];
        webhook: WebhookTaskDbRecord[];
    };
};

export type RouteTaskCallbacks = {
    tasksCreate: (ctx: Context, input: TaskCreateInput) => Promise<TaskDbRecord>;
    tasksRead: (ctx: Context, taskId: string) => Promise<TaskRecordWithTriggers | null>;
    tasksUpdate: (ctx: Context, taskId: string, input: TaskUpdateInput) => Promise<TaskDbRecord | null>;
    tasksDelete: (ctx: Context, taskId: string) => Promise<boolean>;
    tasksRun: (ctx: Context, taskId: string, input: TaskRunInput) => Promise<TaskRunResult>;
    cronTriggerAdd: (ctx: Context, taskId: string, input: CronTriggerAddInput) => Promise<CronTaskDbRecord>;
    cronTriggerRemove: (ctx: Context, taskId: string) => Promise<number>;
    webhookTriggerAdd: (ctx: Context, taskId: string, input: WebhookTriggerAddInput) => Promise<WebhookTaskDbRecord>;
    webhookTriggerRemove: (ctx: Context, taskId: string) => Promise<number>;
};

export type RouteAgentCallbacks = {
    agentList: (ctx: Context) => Promise<AgentListItem[]>;
    agentHistoryLoad: (ctx: Context, agentId: string, limit?: number) => Promise<AgentHistoryRecord[]>;
    agentPost: (ctx: Context, target: AgentPostTarget, item: AgentInboxItem) => Promise<void>;
};

export type RouteCostsCallback = {
    tokenStatsFetch: ((ctx: Context, options: TokenStatsFetchOptions) => Promise<TokenStatsHourlyDbRecord[]>) | null;
};
