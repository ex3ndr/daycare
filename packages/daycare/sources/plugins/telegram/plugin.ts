import path from "node:path";

import { z } from "zod";
import type { PluginOnboardingApi } from "@/types";
import { definePlugin } from "../../engine/plugins/types.js";
import { TelegramConnector, type TelegramConnectorOptions } from "./connector.js";

const allowedUidSchema = z.union([z.string().trim().min(1), z.number().int()]);

const settingsSchema = z
    .object({
        mode: z.enum(["public", "private"]).default("private"),
        allowedUids: z
            .array(allowedUidSchema)
            .optional()
            .default([])
            .transform((values) => Array.from(new Set(values.map((value) => String(value))))),
        polling: z.boolean().optional(),
        clearWebhook: z.boolean().optional(),
        statePath: z.string().nullable().optional()
    })
    .passthrough()
    .superRefine((data, ctx) => {
        if (data.mode !== "private" || data.allowedUids.length > 0) {
            return;
        }
        ctx.addIssue({
            code: z.ZodIssueCode.too_small,
            minimum: 1,
            type: "array",
            inclusive: true,
            message: "allowedUids must have at least 1 entry in private mode",
            path: ["allowedUids"]
        });
    });

type TelegramPluginConfig = Omit<TelegramConnectorOptions, "token" | "fileStore" | "dataDir">;

export const plugin = definePlugin({
    settingsSchema,
    onboarding: async (api) => {
        const token = await api.prompt.input({
            message: "Telegram bot token"
        });
        if (!token) {
            return null;
        }
        const mode = await promptMode(api);
        if (!mode) {
            return null;
        }
        if (mode === "public") {
            await api.auth.setToken(api.instanceId, token);
            return { settings: { mode } };
        }
        const allowedUids = await promptAllowedUids(api);
        if (!allowedUids) {
            return null;
        }
        await api.auth.setToken(api.instanceId, token);
        return { settings: { mode, allowedUids } };
    },
    create: (api) => {
        const connectorId = api.instance.instanceId;
        let connector: TelegramConnector | null = null;
        return {
            load: async () => {
                const token = await api.auth.getToken(connectorId);
                if (!token) {
                    throw new Error("Missing telegram token in auth store");
                }
                if (api.mode === "validate") {
                    return;
                }
                const config = api.settings as TelegramPluginConfig;
                const statePath =
                    config.statePath === undefined
                        ? path.join(api.dataDir, "telegram-offset.json")
                        : config.statePath === null
                          ? null
                          : resolvePluginPath(api.dataDir, config.statePath);
                connector = new TelegramConnector({
                    ...config,
                    statePath,
                    token,
                    fileStore: api.fileStore,
                    dataDir: api.dataDir,
                    enableGracefulShutdown: false,
                    onFatal: (reason, error) => {
                        api.logger.warn({ reason, error }, "event: Telegram connector fatal");
                    }
                });
                api.registrar.registerConnector(connectorId, connector);
            },
            postStart: async () => {
                connector?.commandSyncStart();
            },
            unload: async () => {
                await api.registrar.unregisterConnector(connectorId);
                connector = null;
            }
        };
    }
});

function resolvePluginPath(baseDir: string, target: string): string {
    return path.isAbsolute(target) ? target : path.join(baseDir, target);
}

async function promptMode(api: PluginOnboardingApi): Promise<"public" | "private" | null> {
    return api.prompt.select({
        message: "Telegram access mode",
        choices: [
            {
                value: "private",
                name: "Private",
                description: "Only allow configured Telegram user IDs."
            },
            {
                value: "public",
                name: "Public",
                description: "Allow all Telegram users to interact with the bot."
            }
        ]
    });
}

async function promptAllowedUids(api: PluginOnboardingApi): Promise<string[] | null> {
    for (;;) {
        const input = await api.prompt.input({
            message: "Allowed Telegram user IDs (comma or space separated)"
        });
        if (input === null) {
            return null;
        }
        const parsed = parseAllowedUids(input);
        if (parsed.length > 0) {
            return parsed;
        }
        api.note("Please enter at least one UID.", "Telegram");
    }
}

function parseAllowedUids(input: string): string[] {
    const entries = input
        .split(/[,\s]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);
    return Array.from(new Set(entries));
}
