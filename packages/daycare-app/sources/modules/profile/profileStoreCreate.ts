import { create } from "zustand";
import { profileFetch } from "./profileFetch";
import type { ProfileData } from "./profileTypes";
import { type ProfileUpdateInput, profileUpdate } from "./profileUpdate";

export type ProfileStore = {
    profile: ProfileData | null;
    loading: boolean;
    saving: boolean;
    error: string | null;
    fetch: (baseUrl: string, token: string) => Promise<void>;
    update: (baseUrl: string, token: string, input: ProfileUpdateInput) => Promise<void>;
};

/**
 * Creates a zustand store for user profile data.
 * Manages fetching and updating profile fields.
 */
export function profileStoreCreate() {
    return create<ProfileStore>((set) => ({
        profile: null,
        loading: false,
        saving: false,
        error: null,
        fetch: async (baseUrl, token) => {
            set({ loading: true, error: null });
            try {
                const profile = await profileFetch(baseUrl, token);
                set({ profile, loading: false });
            } catch (err) {
                set({
                    loading: false,
                    error: err instanceof Error ? err.message : "Failed to fetch profile"
                });
            }
        },
        update: async (baseUrl, token, input) => {
            set({ saving: true, error: null });
            try {
                const profile = await profileUpdate(baseUrl, token, input);
                set({ profile, saving: false });
            } catch (err) {
                set({
                    saving: false,
                    error: err instanceof Error ? err.message : "Failed to update profile"
                });
            }
        }
    }));
}
