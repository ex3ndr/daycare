import { create } from "zustand";
import { fragmentsFetch } from "./fragmentsFetch";
import type { FragmentListItem } from "./fragmentsTypes";

export type FragmentsStore = {
    fragments: FragmentListItem[];
    loading: boolean;
    error: string | null;
    fetch: (baseUrl: string, token: string, workspaceId: string | null) => Promise<void>;
};

/**
 * Creates a zustand store for the fragments list.
 * Expects: baseUrl/token come from authenticated app state.
 */
export function fragmentsStoreCreate() {
    return create<FragmentsStore>((set) => ({
        fragments: [],
        loading: false,
        error: null,
        fetch: async (baseUrl, token, workspaceId) => {
            set({ loading: true, error: null });
            try {
                const fragments = await fragmentsFetch(baseUrl, token, workspaceId);
                set({ fragments, loading: false });
            } catch (err) {
                set({
                    loading: false,
                    error: err instanceof Error ? err.message : "Failed to fetch fragments"
                });
            }
        }
    }));
}
