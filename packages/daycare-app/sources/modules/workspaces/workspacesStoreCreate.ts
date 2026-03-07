import { create } from "zustand";
import type { WorkspaceListItem } from "./workspacesFetch";
import { workspacesFetch } from "./workspacesFetch";

export type WorkspacesStore = {
    workspaces: WorkspaceListItem[];
    activeNametag: string | null;
    fetch: (baseUrl: string, token: string) => Promise<void>;
    setActive: (nametag: string) => void;
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
        activeNametag: null,
        fetch: async (baseUrl, token) => {
            const workspaces = await workspacesFetch(baseUrl, token);
            set((state) => {
                const active = state.activeNametag;
                const selfWorkspace = workspaces.find((w) => w.isSelf);
                const resolvedActive =
                    active && workspaces.some((w) => w.nametag === active)
                        ? active
                        : (selfWorkspace?.nametag ?? workspaces[0]?.nametag ?? null);
                return { workspaces, activeNametag: resolvedActive };
            });
        },
        setActive: (nametag) => set({ activeNametag: nametag })
    }));
}
