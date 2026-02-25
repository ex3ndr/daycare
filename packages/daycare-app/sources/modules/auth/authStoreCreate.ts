import { create } from "zustand";

export type AuthState = "unauthenticated" | "authenticated";

export type AuthTokenStorage = {
    read: () => Promise<string | null>;
    write: (token: string) => Promise<void>;
    clear: () => Promise<void>;
};

export type AuthStoreDependencies = {
    baseUrl: string;
    storage: AuthTokenStorage;
    validateToken: (baseUrl: string, token: string) => Promise<{ ok: boolean; userId?: string }>;
};

export type AuthStore = {
    ready: boolean;
    state: AuthState;
    token: string | null;
    userId: string | null;
    bootstrap: () => Promise<void>;
    login: (token: string) => Promise<void>;
    logout: () => Promise<void>;
};

/**
 * Creates an auth store that can validate and persist magic-link tokens.
 * Expects: dependency methods are side-effect safe and return resolved promises.
 */
export function authStoreCreate(dependencies: AuthStoreDependencies) {
    return create<AuthStore>((set) => ({
        ready: false,
        state: "unauthenticated",
        token: null,
        userId: null,
        bootstrap: async () => {
            const storedToken = await dependencies.storage.read();
            if (!storedToken) {
                set({ ready: true, state: "unauthenticated", token: null, userId: null });
                return;
            }

            const result = await dependencies.validateToken(dependencies.baseUrl, storedToken);
            if (result.ok !== true || typeof result.userId !== "string") {
                await dependencies.storage.clear();
                set({ ready: true, state: "unauthenticated", token: null, userId: null });
                return;
            }

            set({
                ready: true,
                state: "authenticated",
                token: storedToken,
                userId: result.userId
            });
        },
        login: async (token) => {
            const result = await dependencies.validateToken(dependencies.baseUrl, token);
            if (result.ok !== true || typeof result.userId !== "string") {
                throw new Error("Invalid or expired token.");
            }

            await dependencies.storage.write(token);
            set({
                ready: true,
                state: "authenticated",
                token,
                userId: result.userId
            });
        },
        logout: async () => {
            await dependencies.storage.clear();
            set({
                ready: true,
                state: "unauthenticated",
                token: null,
                userId: null
            });
        }
    }));
}
