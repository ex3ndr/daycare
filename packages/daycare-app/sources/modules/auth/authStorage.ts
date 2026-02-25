import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { AuthTokenStorage } from "@/modules/auth/authStoreCreate";

const AUTH_TOKEN_KEY = "daycare.app.token";

async function authTokenRead(): Promise<string | null> {
    if (Platform.OS === "web") {
        if (typeof window === "undefined") {
            return null;
        }
        return window.localStorage.getItem(AUTH_TOKEN_KEY);
    }
    return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

async function authTokenWrite(token: string): Promise<void> {
    if (Platform.OS === "web") {
        if (typeof window === "undefined") {
            return;
        }
        window.localStorage.setItem(AUTH_TOKEN_KEY, token);
        return;
    }
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

async function authTokenClear(): Promise<void> {
    if (Platform.OS === "web") {
        if (typeof window === "undefined") {
            return;
        }
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
        return;
    }
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}

export const authStorage: AuthTokenStorage = {
    read: authTokenRead,
    write: authTokenWrite,
    clear: authTokenClear
};
