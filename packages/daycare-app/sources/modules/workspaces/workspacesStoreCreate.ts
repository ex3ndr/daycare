import { create } from "zustand";
import type { WorkspaceListItem } from "./workspacesFetch";
import { workspacesFetch } from "./workspacesFetch";

export type WorkspacesStore = {
    workspaces: WorkspaceListItem[];
    fetch: (baseUrl: string, token: string) => Promise<void>;
};

/**
 * Creates a zustand store for the workspace list.
 * Expects: baseUrl/token come from authenticated app state.
 */
export function workspacesStoreCreate() {
    return create<WorkspacesStore>((set) => ({
        workspaces: [],
        fetch: async (baseUrl, token) => {
            const workspaces = await workspacesFetch(baseUrl, token);
            set({ workspaces });
        }
    }));
}
