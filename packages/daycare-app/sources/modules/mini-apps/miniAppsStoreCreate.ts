import { create } from "zustand";
import { miniAppsFetch } from "./miniAppsFetch";
import type { MiniAppListItem } from "./miniAppsTypes";

export const MINI_APPS_EMPTY: MiniAppListItem[] = [];

export type MiniAppsStore = {
    appsByWorkspace: Record<string, MiniAppListItem[]>;
    loading: boolean;
    loaded: boolean;
    fetchAll: (baseUrl: string, token: string, workspaceIds: string[]) => Promise<void>;
};

/**
 * Creates a zustand store for mini apps keyed by workspace id.
 * Expects: workspaceIds are the currently accessible workspaces for the authenticated user.
 */
export function miniAppsStoreCreate() {
    return create<MiniAppsStore>((set) => ({
        appsByWorkspace: {},
        loading: false,
        loaded: false,
        fetchAll: async (baseUrl, token, workspaceIds) => {
            set({ loading: true });
            const results = await Promise.all(
                workspaceIds.map(async (workspaceId) => {
                    try {
                        return [workspaceId, await miniAppsFetch(baseUrl, token, workspaceId)] as const;
                    } catch {
                        return [workspaceId, [] as MiniAppListItem[]] as const;
                    }
                })
            );
            const appsByWorkspace: Record<string, MiniAppListItem[]> = {};
            for (const [workspaceId, apps] of results) {
                appsByWorkspace[workspaceId] = apps;
            }
            set({
                appsByWorkspace,
                loading: false,
                loaded: true
            });
        }
    }));
}
