import { randomBytes } from "node:crypto";

export const APP_AUTH_SECRET_KEY = "app-auth.jwtSecret";

export type AppAuthStore = {
    getEntry: (id: string) => Promise<Record<string, unknown> | null>;
    setEntry: (id: string, entry: Record<string, unknown>) => Promise<void>;
};

/**
 * Resolves the app JWT secret from plugin settings or auth store, generating one if missing.
 * Expects: settingsSecret may be undefined; auth provides get/set entry access.
 */
export async function appJwtSecretResolve(settingsSecret: string | undefined, auth: AppAuthStore): Promise<string> {
    const fromSettings = settingsSecret?.trim();
    if (fromSettings && fromSettings.length >= 32) {
        return fromSettings;
    }

    const existing = await auth.getEntry(APP_AUTH_SECRET_KEY);
    const existingSecret =
        (typeof existing?.token === "string" ? existing.token : "") ||
        (typeof existing?.secret === "string" ? existing.secret : "") ||
        (typeof existing?.apiKey === "string" ? existing.apiKey : "");

    if (existingSecret.length >= 32) {
        return existingSecret;
    }

    const generated = randomBytes(32).toString("base64url");
    await auth.setEntry(APP_AUTH_SECRET_KEY, {
        type: "token",
        token: generated,
        secret: generated
    });
    return generated;
}
