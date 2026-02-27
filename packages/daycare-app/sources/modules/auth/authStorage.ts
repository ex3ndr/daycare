import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { AuthSession, AuthSessionStorage } from "@/modules/auth/authStoreCreate";

const AUTH_SESSION_KEY = "daycare.app.session";

async function authSessionRead(): Promise<AuthSession | null> {
    const raw = await authSessionReadRaw();
    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as { baseUrl?: unknown; token?: unknown };
        if (typeof parsed.baseUrl !== "string" || typeof parsed.token !== "string") {
            return null;
        }

        const baseUrl = parsed.baseUrl.trim();
        const token = parsed.token.trim();
        if (!baseUrl || !token) {
            return null;
        }

        return {
            baseUrl,
            token
        };
    } catch {
        return null;
    }
}

async function authSessionReadRaw(): Promise<string | null> {
    if (Platform.OS === "web") {
        if (typeof window === "undefined") {
            return null;
        }
        return window.localStorage.getItem(AUTH_SESSION_KEY);
    }
    return SecureStore.getItemAsync(AUTH_SESSION_KEY);
}

async function authSessionWrite(session: AuthSession): Promise<void> {
    const serialized = JSON.stringify(session);
    if (Platform.OS === "web") {
        if (typeof window === "undefined") {
            return;
        }
        window.localStorage.setItem(AUTH_SESSION_KEY, serialized);
        return;
    }
    await SecureStore.setItemAsync(AUTH_SESSION_KEY, serialized);
}

async function authSessionClear(): Promise<void> {
    if (Platform.OS === "web") {
        if (typeof window === "undefined") {
            return;
        }
        window.localStorage.removeItem(AUTH_SESSION_KEY);
        return;
    }
    await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
}

export const authStorage: AuthSessionStorage = {
    read: authSessionRead,
    write: authSessionWrite,
    clear: authSessionClear
};
