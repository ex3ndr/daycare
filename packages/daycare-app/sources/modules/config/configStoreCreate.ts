import { create } from "zustand";
import { configFetch } from "./configFetch";
import type { WorkspaceConfig } from "./configTypes";

const CONFIG_DEFAULT: WorkspaceConfig = {
    homeReady: false,
    appReady: false
};

export type ConfigStore = {
    configs: Record<string, WorkspaceConfig>;
    loaded: boolean;
    fetchAll: (baseUrl: string, token: string, workspaceIds: string[]) => Promise<void>;
    applySync: (workspaceId: string, configuration: WorkspaceConfig) => void;
    configFor: (workspaceId: string) => WorkspaceConfig;
    reset: () => void;
};

/**
 * Creates a zustand store for workspace configuration flags.
 * Stores configs keyed by workspaceId; fetches all at once from (app) layout.
 */
export function configStoreCreate() {
    return create<ConfigStore>((set, get) => ({
        configs: {},
        loaded: false,
        fetchAll: async (baseUrl, token, workspaceIds) => {
            const results = await Promise.all(
                workspaceIds.map(async (id) => {
                    try {
                        return [id, await configFetch(baseUrl, token, id)] as const;
                    } catch {
                        return [id, CONFIG_DEFAULT] as const;
                    }
                })
            );
            const configs: Record<string, WorkspaceConfig> = {};
            for (const [id, config] of results) {
                configs[id] = config;
            }
            set({ configs, loaded: true });
        },
        applySync: (workspaceId, configuration) => {
            set((state) => ({
                configs: { ...state.configs, [workspaceId]: configuration }
            }));
        },
        configFor: (workspaceId) => {
            return get().configs[workspaceId] ?? CONFIG_DEFAULT;
        },
        reset: () => {
            set({ configs: {}, loaded: false });
        }
    }));
}
