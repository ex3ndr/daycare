import { z } from "zod";
import type { AppServerSettings } from "../../settings.js";
import { appEndpointNormalize } from "./appEndpointNormalize.js";

export const APP_SERVER_DEFAULT_HOST = "127.0.0.1";
export const APP_SERVER_DEFAULT_PORT = 7332;

export type AppServerResolvedSettings = {
    enabled: boolean;
    host: string;
    port: number;
    appEndpoint?: string;
    serverEndpoint?: string;
    jwtSecret?: string;
    telegramInstanceId?: string;
};

const appServerSettingsSchema = z
    .object({
        enabled: z.boolean().default(false),
        host: z.string().trim().min(1).default(APP_SERVER_DEFAULT_HOST),
        port: z.coerce.number().int().min(1).max(65535).default(APP_SERVER_DEFAULT_PORT),
        appEndpoint: appEndpointSettingSchema("appEndpoint"),
        serverEndpoint: appEndpointSettingSchema("serverEndpoint"),
        jwtSecret: z.string().trim().min(32).optional(),
        telegramInstanceId: z.string().trim().min(1).optional()
    })
    .strict();

/**
 * Resolves app server runtime settings with validation and defaults.
 * Returns a normalized appServer config with endpoint and secret checks.
 *
 * Expects: settings were parsed from the Daycare settings document.
 */
export function appServerSettingsResolve(settings: AppServerSettings | undefined): AppServerResolvedSettings {
    return appServerSettingsSchema.parse(settings ?? {});
}

function appEndpointSettingSchema(fieldName: string): z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined> {
    return z
        .string()
        .trim()
        .min(1)
        .optional()
        .transform((value, context) => {
            try {
                return appEndpointNormalize(value, fieldName);
            } catch (error) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: error instanceof Error ? error.message : `Invalid ${fieldName}.`
                });
                return z.NEVER;
            }
        });
}
