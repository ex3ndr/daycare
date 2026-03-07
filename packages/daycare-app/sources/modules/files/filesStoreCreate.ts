import { create } from "zustand";
import { filesFetchRoots } from "./filesFetchRoots";
import type { FileRoot } from "./filesTypes";

export type FilesStore = {
    roots: FileRoot[];
    loading: boolean;
    error: string | null;

    fetchRoots: (baseUrl: string, token: string, workspaceNametag: string | null) => Promise<void>;
};

/**
 * Creates a zustand store for the file browser.
 * Only manages roots — directory navigation uses Expo Router URLs.
 */
export function filesStoreCreate() {
    return create<FilesStore>((set) => ({
        roots: [],
        loading: false,
        error: null,

        fetchRoots: async (baseUrl, token, workspaceNametag) => {
            set({ loading: true, error: null });
            try {
                const roots = await filesFetchRoots(baseUrl, token, workspaceNametag);
                set({ roots, loading: false });
            } catch (err) {
                set({ loading: false, error: err instanceof Error ? err.message : "Failed to fetch roots." });
            }
        }
    }));
}
