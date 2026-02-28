import { create } from "zustand";
import { costsFetch } from "./costsFetch";
import { costsPeriodRange } from "./costsPeriodRange";
import type { CostsPeriod, TokenStatsRow } from "./costsTypes";

export type CostsStore = {
    period: CostsPeriod;
    rows: TokenStatsRow[];
    loading: boolean;
    error: string | null;
    setPeriod: (period: CostsPeriod) => void;
    fetch: (baseUrl: string, token: string) => Promise<void>;
};

/**
 * Creates a zustand store for token cost data.
 * Manages fetching, period selection, and raw row storage.
 * Derived data (summary, breakdowns, chart) is computed in the view.
 */
export function costsStoreCreate() {
    return create<CostsStore>((set, get) => ({
        period: "7d",
        rows: [],
        loading: false,
        error: null,
        setPeriod: (period) => {
            set({ period });
        },
        fetch: async (baseUrl, token) => {
            const { period } = get();
            set({ loading: true, error: null });
            try {
                const range = costsPeriodRange(period);
                const rows = await costsFetch(baseUrl, token, range);
                set({ rows, loading: false });
            } catch (err) {
                set({
                    loading: false,
                    error: err instanceof Error ? err.message : "Failed to fetch costs"
                });
            }
        }
    }));
}
