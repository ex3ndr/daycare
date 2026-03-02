import { create } from "zustand";
import { tasksFetch } from "./tasksFetch";
import type { CronTriggerSummary, TaskSummary, WebhookTriggerSummary } from "./tasksTypes";

export type TasksStore = {
    tasks: TaskSummary[];
    triggers: {
        cron: CronTriggerSummary[];
        webhook: WebhookTriggerSummary[];
    };
    loading: boolean;
    error: string | null;
    fetch: (baseUrl: string, token: string) => Promise<void>;
};

/**
 * Creates a zustand store for task data.
 * Stores all tasks and triggers separately.
 * Derived data (status, subtitle) is computed in the view via pure helpers.
 */
export function tasksStoreCreate() {
    return create<TasksStore>((set) => ({
        tasks: [],
        triggers: { cron: [], webhook: [] },
        loading: false,
        error: null,
        fetch: async (baseUrl, token) => {
            set({ loading: true, error: null });
            try {
                const result = await tasksFetch(baseUrl, token);
                set({ tasks: result.tasks, triggers: result.triggers, loading: false });
            } catch (err) {
                set({
                    loading: false,
                    error: err instanceof Error ? err.message : "Failed to fetch tasks"
                });
            }
        }
    }));
}
