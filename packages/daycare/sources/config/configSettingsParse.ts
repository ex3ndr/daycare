import { z } from "zod";

import type { SettingsConfig } from "../settings.js";

/**
 * Parses raw settings data into a validated SettingsConfig.
 * Expects: raw is JSON-compatible and matches the settings schema.
 */
export function configSettingsParse(raw: unknown): SettingsConfig {
    const pluginInstance = z
        .object({
            instanceId: z.string().min(1),
            pluginId: z.string().min(1),
            enabled: z.boolean().optional(),
            settings: z.record(z.unknown()).optional()
        })
        .passthrough();

    const imageSettings = z
        .object({
            enabled: z.boolean().optional(),
            model: z.string().optional(),
            size: z.string().optional(),
            quality: z.enum(["standard", "hd"]).optional(),
            endpoint: z.string().optional(),
            apiKeyHeader: z.string().optional(),
            apiKeyPrefix: z.string().optional()
        })
        .passthrough();

    const provider = z
        .object({
            id: z.string().min(1),
            enabled: z.boolean().optional(),
            model: z.string().optional(),
            options: z.record(z.unknown()).optional(),
            image: imageSettings.optional()
        })
        .passthrough();

    const inferenceProvider = z
        .object({
            id: z.string().min(1),
            model: z.string().optional(),
            options: z.record(z.unknown()).optional()
        })
        .passthrough();

    const settingsSchema = z
        .object({
            docker: z
                .object({
                    enabled: z.boolean().optional(),
                    image: z.string().min(1).optional(),
                    tag: z.string().min(1).optional(),
                    socketPath: z.string().min(1).optional(),
                    runtime: z.string().min(1).optional(),
                    unconfinedSecurity: z.boolean().optional()
                })
                .passthrough()
                .optional(),
            features: z
                .object({
                    say: z.boolean().optional(),
                    rlm: z.boolean().optional(),
                    noTools: z.boolean().optional()
                })
                .passthrough()
                .optional(),
            engine: z
                .object({
                    socketPath: z.string().min(1).optional(),
                    dataDir: z.string().min(1).optional(),
                    dbPath: z.string().min(1).optional()
                })
                .passthrough()
                .optional(),
            assistant: z
                .object({
                    systemPrompt: z.string().min(1).optional()
                })
                .passthrough()
                .optional(),
            agents: z
                .object({
                    emergencyContextLimit: z.number().int().positive().optional()
                })
                .passthrough()
                .optional(),
            security: z
                .object({
                    appReviewerEnabled: z.boolean().optional()
                })
                .passthrough()
                .optional(),
            plugins: z.array(pluginInstance).optional(),
            providers: z.array(provider).optional(),
            inference: z
                .object({
                    providers: z.array(inferenceProvider).optional()
                })
                .passthrough()
                .optional(),
            cron: z
                .object({
                    tasks: z.array(z.record(z.unknown())).optional()
                })
                .passthrough()
                .optional(),
            memory: z
                .object({
                    enabled: z.boolean().optional(),
                    maxEntries: z.number().int().positive().optional()
                })
                .passthrough()
                .optional()
        })
        .passthrough();

    return settingsSchema.parse(raw) as SettingsConfig;
}
