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

export type TaskStatus = "ok" | "warning";
