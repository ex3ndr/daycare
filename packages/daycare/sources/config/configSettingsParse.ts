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
                    enableWeakerNestedSandbox: z.boolean().optional(),
                    readOnly: z.boolean().optional(),
                    unconfinedSecurity: z.boolean().optional(),
                    capAdd: z.array(z.string().min(1)).optional(),
                    capDrop: z.array(z.string().min(1)).optional(),
                    allowLocalNetworkingForUsers: z.array(z.string().min(1)).optional(),
                    isolatedDnsServers: z.array(z.string().min(1)).optional(),
                    localDnsServers: z.array(z.string().min(1)).optional()
                })
                .passthrough()
                .optional(),
            engine: z
                .object({
                    socketPath: z.string().min(1).optional(),
                    dataDir: z.string().min(1).optional(),
                    dbPath: z.string().min(1).optional(),
                    dbUrl: z
                        .string()
                        .min(1)
                        .refine(
                            (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
                            "engine.dbUrl must start with postgres:// or postgresql://"
                        )
                        .optional(),
                    autoMigrate: z.boolean().optional()
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
            models: z
                .object({
                    user: z.string().min(1).optional(),
                    memory: z.string().min(1).optional(),
                    memorySearch: z.string().min(1).optional(),
                    subagent: z.string().min(1).optional(),
                    heartbeat: z.string().min(1).optional()
                })
                .partial()
                .optional(),
            modelSizes: z
                .object({
                    small: z.string().min(1).optional(),
                    normal: z.string().min(1).optional(),
                    large: z.string().min(1).optional()
                })
                .partial()
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
