import { create } from "zustand";
import { configFetch } from "./configFetch";
import type { WorkspaceConfig } from "./configTypes";

const CONFIG_DEFAULT: WorkspaceConfig = {
    homeReady: false,
    appReady: false
};

export type ConfigStore = {
    config: WorkspaceConfig;
    loaded: boolean;
    fetch: (baseUrl: string, token: string, workspaceId: string) => Promise<void>;
    applySync: (configuration: WorkspaceConfig) => void;
    reset: () => void;
};

/**
 * Creates a zustand store for workspace configuration flags.
 * Manages initial fetch and realtime SSE sync.
 */
export function configStoreCreate() {
    return create<ConfigStore>((set) => ({
        config: CONFIG_DEFAULT,
        loaded: false,
        fetch: async (baseUrl, token, workspaceId) => {
            try {
                const config = await configFetch(baseUrl, token, workspaceId);
                set({ config, loaded: true });
            } catch {
                // On failure, use defaults so the app can still render
                set({ config: CONFIG_DEFAULT, loaded: true });
            }
        },
        applySync: (configuration) => {
            set({ config: configuration });
        },
        reset: () => {
            set({ config: CONFIG_DEFAULT, loaded: false });
        }
    }));
}
