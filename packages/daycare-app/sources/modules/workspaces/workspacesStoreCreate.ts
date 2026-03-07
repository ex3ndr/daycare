import { create } from "zustand";
import type { WorkspaceListItem } from "./workspacesFetch";
import { workspacesFetch } from "./workspacesFetch";

export type WorkspacesStore = {
    workspaces: WorkspaceListItem[];
    activeId: string | null;
    fetch: (baseUrl: string, token: string) => Promise<void>;
    setActive: (id: string) => void;
};

/**
 * Creates a zustand store for the workspace list and active selection.
 * On fetch, resolves the active workspace to the current selection, the self workspace, or the first available.
 *
 * Expects: baseUrl/token come from authenticated app state.
 */
export function workspacesStoreCreate() {
    return create<WorkspacesStore>((set) => ({
        workspaces: [],
        activeId: null,
        fetch: async (baseUrl, token) => {
            const workspaces = await workspacesFetch(baseUrl, token);
            set((state) => {
                const active = state.activeId;
                const selfWorkspace = workspaces.find((w) => w.isSelf);
                const resolvedActive =
                    active && workspaces.some((w) => w.userId === active)
                        ? active
                        : (selfWorkspace?.userId ?? workspaces[0]?.userId ?? null);
                return { workspaces, activeId: resolvedActive };
            });
        },
        setActive: (id) => set({ activeId: id })
    }));
}
