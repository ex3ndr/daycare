import { create } from "zustand";
import { filesFetchDir } from "./filesFetchDir";
import { filesFetchPreview } from "./filesFetchPreview";
import { filesFetchRoots } from "./filesFetchRoots";
import type { FileEntry, FilePreview, FileRoot } from "./filesTypes";

export type FilesStore = {
    roots: FileRoot[];
    currentPath: string | null;
    entries: FileEntry[];
    selectedFile: string | null;
    preview: FilePreview | null;
    loading: boolean;
    previewLoading: boolean;
    error: string | null;

    fetchRoots: (baseUrl: string, token: string) => Promise<void>;
    navigateTo: (baseUrl: string, token: string, dirPath: string) => Promise<void>;
    selectFile: (baseUrl: string, token: string, filePath: string) => Promise<void>;
    clearPreview: () => void;
    goHome: () => void;
};

/**
 * Creates a zustand store for the file browser state.
 * Manages roots, directory listing, navigation, and file preview.
 */
export function filesStoreCreate() {
    return create<FilesStore>((set) => ({
        roots: [],
        currentPath: null,
        entries: [],
        selectedFile: null,
        preview: null,
        loading: false,
        previewLoading: false,
        error: null,

        fetchRoots: async (baseUrl, token) => {
            try {
                const roots = await filesFetchRoots(baseUrl, token);
                set({ roots });
            } catch (err) {
                set({ error: err instanceof Error ? err.message : "Failed to fetch roots." });
            }
        },

        navigateTo: async (baseUrl, token, dirPath) => {
            set({ loading: true, error: null, selectedFile: null, preview: null });
            try {
                const entries = await filesFetchDir(baseUrl, token, dirPath);
                set({ currentPath: dirPath, entries, loading: false });
            } catch (err) {
                set({ loading: false, error: err instanceof Error ? err.message : "Failed to list directory." });
            }
        },

        selectFile: async (baseUrl, token, filePath) => {
            set({ selectedFile: filePath, previewLoading: true, preview: null });
            try {
                const preview = await filesFetchPreview(baseUrl, token, filePath);
                set({ preview, previewLoading: false });
            } catch (err) {
                set({
                    previewLoading: false,
                    preview: null,
                    error: err instanceof Error ? err.message : "Failed to read file."
                });
            }
        },

        clearPreview: () => set({ selectedFile: null, preview: null }),

        goHome: () => set({ currentPath: null, entries: [], selectedFile: null, preview: null, error: null })
    }));
}
