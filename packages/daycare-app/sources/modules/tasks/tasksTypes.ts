export type TaskActiveCronTrigger = {
    id: string;
    schedule: string;
    timezone: string;
    agentId: string | null;
    lastExecutedAt: number | null;
};

export type TaskActiveWebhookTrigger = {
    id: string;
    agentId: string | null;
    lastExecutedAt: number | null;
};

export type TaskActiveSummary = {
    id: string;
    title: string;
    description: string | null;
    createdAt: number;
    updatedAt: number;
    lastExecutedAt: number | null;
    triggers: {
        cron: TaskActiveCronTrigger[];
        webhook: TaskActiveWebhookTrigger[];
    };
};

export type TaskSummary = {
    id: string;
    title: string;
    description: string | null;
    createdAt: number;
    updatedAt: number;
    lastExecutedAt: number | null;
};

export type CronTriggerSummary = {
    id: string;
    taskId: string;
    schedule: string;
    timezone: string;
    agentId: string | null;
    enabled: boolean;
    lastExecutedAt: number | null;
};

export type WebhookTriggerSummary = {
    id: string;
    taskId: string;
    agentId: string | null;
    lastExecutedAt: number | null;
};

export type TaskListAllResult = {
    tasks: TaskSummary[];
    triggers: {
        cron: CronTriggerSummary[];
        webhook: WebhookTriggerSummary[];
    };
};

export type TaskStatus = "ok" | "warning";
