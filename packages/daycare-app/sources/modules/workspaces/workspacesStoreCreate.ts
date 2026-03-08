import { create } from "zustand";
import { routeDebugLog } from "@/modules/navigation/routeDebugLog";
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
            routeDebugLog("workspaces-fetch-start", {
                baseUrl
            });
            set({ loading: true });
            const workspaces = await workspacesFetch(baseUrl, token);
            routeDebugLog("workspaces-fetch-success", {
                workspaceCount: workspaces.length,
                workspaceIds: workspaces.map((workspace) => workspace.userId)
            });
            set({ workspaces, loading: false, loaded: true });
        }
    }));
}
