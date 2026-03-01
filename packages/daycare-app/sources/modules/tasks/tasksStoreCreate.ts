import { create } from "zustand";
import { tasksFetch } from "./tasksFetch";
import type { TaskActiveSummary } from "./tasksTypes";

export type TasksStore = {
    tasks: TaskActiveSummary[];
    loading: boolean;
    error: string | null;
    fetch: (baseUrl: string, token: string) => Promise<void>;
};

/**
 * Creates a zustand store for active task data.
 * Manages fetching and raw task storage.
 * Derived data (status, subtitle) is computed in the view via pure helpers.
 */
export function tasksStoreCreate() {
    return create<TasksStore>((set) => ({
        tasks: [],
        loading: false,
        error: null,
        fetch: async (baseUrl, token) => {
            set({ loading: true, error: null });
            try {
                const tasks = await tasksFetch(baseUrl, token);
                set({ tasks, loading: false });
            } catch (err) {
                set({
                    loading: false,
                    error: err instanceof Error ? err.message : "Failed to fetch tasks"
                });
            }
        }
    }));
}
