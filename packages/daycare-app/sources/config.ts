import Constants from "expo-constants";

export type AppConfig = {
    apiBaseUrl: string;
};

/**
 * Loads app config from EXPO public env and manifest extras.
 * Expects: fallback URL points to local daycare-app-server.
 */
export function appConfigLoad(): AppConfig {
    const fromEnv = process.env.EXPO_PUBLIC_DAYCARE_API_BASE_URL;
    const fromExtra = (Constants.expoConfig?.extra as { app?: { apiBaseUrl?: string } } | undefined)?.app?.apiBaseUrl;

    return {
        apiBaseUrl: fromEnv ?? fromExtra ?? "http://127.0.0.1:7332"
    };
}

export const appConfig = appConfigLoad();
