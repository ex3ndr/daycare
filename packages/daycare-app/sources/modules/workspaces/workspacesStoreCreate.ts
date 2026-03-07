import { create } from "zustand";
import type { WorkspaceListItem } from "./workspacesFetch";
import { workspacesFetch } from "./workspacesFetch";

export type WorkspacesStore = {
    workspaces: WorkspaceListItem[];
    loading: boolean;
    loaded: boolean;
    fetch: (baseUrl: string, token: string) => Promise<void>;
};

/**
 * Creates a zustand store for the workspace list.
 * Expects: baseUrl/token come from authenticated app state.
 */
export function workspacesStoreCreate() {
    return create<WorkspacesStore>((set) => ({
        workspaces: [],
        loading: false,
        loaded: false,
        fetch: async (baseUrl, token) => {
            set({ loading: true });
            const workspaces = await workspacesFetch(baseUrl, token);
            set({ workspaces, loading: false, loaded: true });
        }
    }));
}
