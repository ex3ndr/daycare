import { z } from "zod";

import { REASONING_LEVELS, type SettingsConfig } from "../settings.js";

/**
 * Parses raw settings data into a validated SettingsConfig.
 * Expects: raw is JSON-compatible and matches the settings schema.
 */
export function configSettingsParse(raw: unknown): SettingsConfig {
    const modelSelection = z
        .object({
            model: z.string().min(1),
            reasoning: z.enum(REASONING_LEVELS).optional()
        })
        .passthrough();

    const legacyOrStructuredModelSelection = z
        .union([z.string().min(1), modelSelection])
        .transform((value) => (typeof value === "string" ? { model: value } : value));

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
            reasoning: z.enum(REASONING_LEVELS).optional(),
            options: z.record(z.unknown()).optional(),
            image: imageSettings.optional()
        })
        .passthrough();

    const inferenceProvider = z
        .object({
            id: z.string().min(1),
            model: z.string().optional(),
            reasoning: z.enum(REASONING_LEVELS).optional(),
            options: z.record(z.unknown()).optional()
        })
        .passthrough();

    const settingsSchema = z
        .object({
            docker: z
                .object({
                    socketPath: z.string().min(1).optional(),
                    runtime: z.string().min(1).optional(),
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
            sandbox: z
                .object({
                    backend: z.enum(["docker", "opensandbox"]).optional()
                })
                .passthrough()
                .optional(),
            opensandbox: z
                .object({
                    domain: z.string().min(1).optional(),
                    apiKey: z.string().min(1).optional(),
                    image: z.string().min(1).optional(),
                    timeoutSeconds: z.number().int().positive().optional()
                })
                .passthrough()
                .optional(),
            engine: z
                .object({
                    socketPath: z.string().min(1).optional(),
                    dataDir: z.string().min(1).optional(),
                    db: z
                        .object({
                            path: z.string().min(1).optional(),
                            url: z.string().min(1).optional(),
                            autoMigrate: z.boolean().optional()
                        })
                        .passthrough()
                        .optional()
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
            appServer: z
                .object({
                    enabled: z.boolean().optional(),
                    host: z.string().min(1).optional(),
                    port: z.coerce.number().int().min(1).max(65535).optional(),
                    appEndpoint: z.string().min(1).optional(),
                    serverEndpoint: z.string().min(1).optional(),
                    jwtSecret: z.string().min(32).optional(),
                    telegramInstanceId: z.string().min(1).optional(),
                    emailAuth: z
                        .object({
                            smtpUrl: z.string().min(1).optional(),
                            from: z.string().min(1).optional(),
                            replyTo: z.string().min(1).optional()
                        })
                        .passthrough()
                        .optional()
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
                    user: legacyOrStructuredModelSelection.optional(),
                    memory: legacyOrStructuredModelSelection.optional(),
                    memorySearch: legacyOrStructuredModelSelection.optional(),
                    subagent: legacyOrStructuredModelSelection.optional(),
                    task: legacyOrStructuredModelSelection.optional()
                })
                .partial()
                .optional(),
            modelFlavors: z
                .record(
                    z.object({
                        model: z.string().min(1),
                        description: z.string().min(1),
                        reasoning: z.enum(REASONING_LEVELS).optional()
                    })
                )
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
