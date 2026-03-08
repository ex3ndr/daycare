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
    path: string | null;
    kind: string;
    name: string | null;
    description: string | null;
    connectorName: string | null;
    foreground: boolean;
    lifecycle: AgentLifecycleState;
    createdAt: number;
    updatedAt: number;
    userId?: string;
};

export type AgentCreateInput = {
    systemPrompt: string;
    name?: string | null;
    description?: string | null;
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
    agentHistoryLoadAfter: (
        ctx: Context,
        agentId: string,
        after: number,
        limit?: number
    ) => Promise<AgentHistoryRecord[]>;
    agentCreate: (ctx: Context, input: AgentCreateInput) => Promise<{ agentId: string; initializedAt: number }>;
    agentKill: (ctx: Context, agentId: string) => Promise<boolean>;
    agentPost: (ctx: Context, target: AgentPostTarget, item: AgentInboxItem) => Promise<void>;
    agentDirectResolve: (ctx: Context) => Promise<string>;
    agentSupervisorResolve: (ctx: Context) => Promise<string>;
};

export type RouteCostsCallback = {
    tokenStatsFetch: ((ctx: Context, options: TokenStatsFetchOptions) => Promise<TokenStatsHourlyDbRecord[]>) | null;
};
