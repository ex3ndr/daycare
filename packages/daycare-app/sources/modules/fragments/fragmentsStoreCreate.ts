import { create } from "zustand";
import { fragmentsFetch } from "./fragmentsFetch";
import type { FragmentListItem } from "./fragmentsTypes";

export type FragmentsStore = {
    fragments: FragmentListItem[];
    selectedFragment: FragmentListItem | null;
    loading: boolean;
    error: string | null;
    fetch: (baseUrl: string, token: string) => Promise<void>;
    select: (fragment: FragmentListItem | null) => void;
};

/**
 * Creates a zustand store for the fragments list.
 * Expects: baseUrl/token come from authenticated app state.
 */
export function fragmentsStoreCreate() {
    return create<FragmentsStore>((set) => ({
        fragments: [],
        selectedFragment: null,
        loading: false,
        error: null,
        select: (fragment) => set({ selectedFragment: fragment }),
        fetch: async (baseUrl, token) => {
            set({ loading: true, error: null });
            try {
                const fragments = await fragmentsFetch(baseUrl, token);
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
