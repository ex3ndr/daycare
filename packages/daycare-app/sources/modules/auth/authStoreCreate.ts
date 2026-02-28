import { create } from "zustand";

export type AuthState = "unauthenticated" | "authenticated";

export type AuthSession = {
    baseUrl: string;
    token: string;
};

export type AuthSessionStorage = {
    read: () => Promise<AuthSession | null>;
    write: (session: AuthSession) => Promise<void>;
    clear: () => Promise<void>;
};

export type AuthStoreDependencies = {
    storage: AuthSessionStorage;
    validateToken: (baseUrl: string, token: string) => Promise<{ ok: boolean; userId?: string }>;
    sessionResolve?: () => Promise<AuthSession | null>;
};

export type AuthStore = {
    ready: boolean;
    state: AuthState;
    baseUrl: string | null;
    token: string | null;
    userId: string | null;
    bootstrap: () => Promise<void>;
    login: (baseUrl: string, token: string) => Promise<void>;
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
        baseUrl: null,
        token: null,
        userId: null,
        bootstrap: async () => {
            const resolvedSession = await dependencies.sessionResolve?.();
            if (resolvedSession) {
                const result = await dependencies.validateToken(resolvedSession.baseUrl, resolvedSession.token);
                if (result.ok === true && typeof result.userId === "string") {
                    await dependencies.storage.write({
                        baseUrl: resolvedSession.baseUrl,
                        token: resolvedSession.token
                    });
                    set({
                        ready: true,
                        state: "authenticated",
                        baseUrl: resolvedSession.baseUrl,
                        token: resolvedSession.token,
                        userId: result.userId
                    });
                    return;
                }
            }

            const storedSession = await dependencies.storage.read();
            if (!storedSession) {
                set({ ready: true, state: "unauthenticated", baseUrl: null, token: null, userId: null });
                return;
            }

            const result = await dependencies.validateToken(storedSession.baseUrl, storedSession.token);
            if (result.ok !== true || typeof result.userId !== "string") {
                await dependencies.storage.clear();
                set({ ready: true, state: "unauthenticated", baseUrl: null, token: null, userId: null });
                return;
            }

            set({
                ready: true,
                state: "authenticated",
                baseUrl: storedSession.baseUrl,
                token: storedSession.token,
                userId: result.userId
            });
        },
        login: async (baseUrl, token) => {
            const trimmedBaseUrl = baseUrl.trim();
            const trimmedToken = token.trim();
            const result = await dependencies.validateToken(trimmedBaseUrl, trimmedToken);
            if (result.ok !== true || typeof result.userId !== "string") {
                throw new Error("Invalid or expired token.");
            }

            await dependencies.storage.write({
                baseUrl: trimmedBaseUrl,
                token: trimmedToken
            });
            set({
                ready: true,
                state: "authenticated",
                baseUrl: trimmedBaseUrl,
                token: trimmedToken,
                userId: result.userId
            });
        },
        logout: async () => {
            await dependencies.storage.clear();
            set({
                ready: true,
                state: "unauthenticated",
                baseUrl: null,
                token: null,
                userId: null
            });
        }
    }));
}
