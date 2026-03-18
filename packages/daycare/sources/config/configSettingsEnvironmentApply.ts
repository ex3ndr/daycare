import type { SettingsConfig } from "../settings.js";

const DATABASE_URL_ENV = "DATABASE_URL";
const SMTP_URL_ENV = "SMTP_URL";

/**
 * Applies supported process environment overrides to parsed settings.
 * Expects: settings already came from JSON parsing/normalization; blank env values are ignored.
 */
export function configSettingsEnvironmentApply(
    settings: SettingsConfig,
    env: NodeJS.ProcessEnv = process.env
): SettingsConfig {
    const next = {
        ...settings,
        engine: settings.engine ? { ...settings.engine } : undefined,
        email: settings.email ? { ...settings.email } : undefined
    };

    const configuredDatabaseUrl = configStringResolve(settings.engine?.db?.url);
    const databaseUrl = envStringResolve(env, DATABASE_URL_ENV);
    if (!configuredDatabaseUrl && databaseUrl) {
        next.engine = {
            ...next.engine,
            db: {
                ...next.engine?.db,
                url: databaseUrl
            }
        };
    }

    const configuredSmtpUrl = configStringResolve(settings.email?.smtpUrl);
    const smtpUrl = envStringResolve(env, SMTP_URL_ENV);
    if (!configuredSmtpUrl && smtpUrl) {
        next.email = {
            ...next.email,
            smtpUrl
        };
    }

    return next;
}

function configStringResolve(value: string | undefined): string | null {
    if (!value) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function envStringResolve(env: NodeJS.ProcessEnv, key: string): string | null {
    const value = env[key];
    if (!value) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
