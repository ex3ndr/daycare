import { create } from "zustand";
import { membersFetch } from "./membersFetch";
import type { MemberItem } from "./membersTypes";

export type MembersStore = {
    members: MemberItem[];
    loading: boolean;
    error: string | null;
    fetch: (baseUrl: string, token: string, nametag: string) => Promise<void>;
    applyKicked: (userId: string) => void;
};

/**
 * Creates a workspace members store backed by the members API.
 * Expects: baseUrl/token/nametag come from authenticated workspace app state.
 */
export function membersStoreCreate() {
    return create<MembersStore>((set) => ({
        members: [],
        loading: false,
        error: null,
        fetch: async (baseUrl, token, nametag) => {
            set({ loading: true, error: null });
            try {
                const members = await membersFetch(baseUrl, token, nametag);
                set({ members, loading: false, error: null });
            } catch (error) {
                set({
                    members: [],
                    loading: false,
                    error: error instanceof Error ? error.message : "Failed to fetch members."
                });
            }
        },
        applyKicked: (userId) =>
            set((state) => ({
                members: state.members.filter((member) => member.userId !== userId)
            }))
    }));
}
