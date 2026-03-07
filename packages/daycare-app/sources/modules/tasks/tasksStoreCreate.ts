import { create } from "zustand";
import { taskDetailFetch } from "./taskDetailFetch";
import { tasksFetch } from "./tasksFetch";
import type { CronTriggerSummary, TaskDetailResult, TaskSummary, WebhookTriggerSummary } from "./tasksTypes";

export type TasksStore = {
    tasks: TaskSummary[];
    triggers: {
        cron: CronTriggerSummary[];
        webhook: WebhookTriggerSummary[];
    };
    loading: boolean;
    error: string | null;
    fetch: (baseUrl: string, token: string, workspaceId: string | null) => Promise<void>;

    selectedTaskId: string | null;
    selectedDetail: TaskDetailResult | null;
    detailLoading: boolean;
    selectTask: (baseUrl: string, token: string, workspaceId: string | null, taskId: string | null) => void;
};

/**
 * Creates a zustand store for task data.
 * Stores all tasks and triggers separately, with optional detail for selected task.
 * Derived data (status, subtitle) is computed in the view via pure helpers.
 */
export function tasksStoreCreate() {
    return create<TasksStore>((set) => ({
        tasks: [],
        triggers: { cron: [], webhook: [] },
        loading: false,
        error: null,
        fetch: async (baseUrl, token, workspaceId) => {
            set({ loading: true, error: null });
            try {
                const result = await tasksFetch(baseUrl, token, workspaceId);
                set({ tasks: result.tasks, triggers: result.triggers, loading: false });
            } catch (err) {
                set({
                    loading: false,
                    error: err instanceof Error ? err.message : "Failed to fetch tasks"
                });
            }
        },

        selectedTaskId: null,
        selectedDetail: null,
        detailLoading: false,
        selectTask: (baseUrl, token, workspaceId, taskId) => {
            if (!taskId) {
                set({ selectedTaskId: null, selectedDetail: null, detailLoading: false });
                return;
            }
            set({ selectedTaskId: taskId, selectedDetail: null, detailLoading: true });
            void taskDetailFetch(baseUrl, token, workspaceId, taskId).then(
                (detail) => {
                    set((state) => {
                        // Only apply if this task is still selected
                        if (state.selectedTaskId !== taskId) return state;
                        return { selectedDetail: detail, detailLoading: false };
                    });
                },
                () => {
                    set((state) => {
                        if (state.selectedTaskId !== taskId) return state;
                        return { detailLoading: false };
                    });
                }
            );
        }
    }));
}
