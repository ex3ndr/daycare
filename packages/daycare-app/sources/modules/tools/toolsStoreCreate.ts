import { create } from "zustand";
import { toolsFetch } from "./toolsFetch";
import type { ToolListItem } from "./toolsTypes";

export type ToolsStore = {
    tools: ToolListItem[];
    loading: boolean;
    error: string | null;
    fetch: (baseUrl: string, token: string) => Promise<void>;
};

/**
 * Creates a zustand store for the tools list.
 * Expects: baseUrl/token come from authenticated app state.
 */
export function toolsStoreCreate() {
    return create<ToolsStore>((set) => ({
        tools: [],
        loading: false,
        error: null,
        fetch: async (baseUrl, token) => {
            set({ loading: true, error: null });
            try {
                const tools = await toolsFetch(baseUrl, token);
                set({ tools, loading: false });
            } catch (err) {
                set({
                    loading: false,
                    error: err instanceof Error ? err.message : "Failed to fetch tools"
                });
            }
        }
    }));
}
