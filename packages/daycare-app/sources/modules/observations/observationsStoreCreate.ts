import { create } from "zustand";
import { observationsFetch } from "./observationsFetch";
import type { ObservationItem } from "./observationsTypes";

export type ObservationsStore = {
    observations: ObservationItem[];
    loading: boolean;
    error: string | null;
    fetch: (baseUrl: string, token: string) => Promise<void>;
};

/**
 * Creates a zustand store for observations (activity log).
 * Read-only — no delta merges needed since observations are append-only.
 *
 * Expects: baseUrl/token come from authenticated app state.
 */
export function observationsStoreCreate() {
    return create<ObservationsStore>((set) => ({
        observations: [],
        loading: false,
        error: null,
        fetch: async (baseUrl, token) => {
            set({ loading: true, error: null });
            try {
                const observations = await observationsFetch(baseUrl, token);
                set({ observations, loading: false });
            } catch (err) {
                set({
                    loading: false,
                    error: err instanceof Error ? err.message : "Failed to fetch observations"
                });
            }
        }
    }));
}
