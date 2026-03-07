import { create } from "zustand";
import { skillsFetch } from "./skillsFetch";
import type { SkillListItem } from "./skillsTypes";

export type SkillsStore = {
    skills: SkillListItem[];
    loading: boolean;
    error: string | null;
    fetch: (baseUrl: string, token: string, workspaceId: string | null) => Promise<void>;
};

/**
 * Creates a zustand store for skills list data.
 * Manages fetching and raw skill storage.
 */
export function skillsStoreCreate() {
    return create<SkillsStore>((set) => ({
        skills: [],
        loading: false,
        error: null,
        fetch: async (baseUrl, token, workspaceId) => {
            set({ loading: true, error: null });
            try {
                const skills = await skillsFetch(baseUrl, token, workspaceId);
                set({ skills, loading: false });
            } catch (err) {
                set({
                    loading: false,
                    error: err instanceof Error ? err.message : "Failed to fetch skills"
                });
            }
        }
    }));
}
