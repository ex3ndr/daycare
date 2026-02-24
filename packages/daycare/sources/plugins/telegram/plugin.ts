import { promises as fs } from "node:fs";
import path from "node:path";

import { z } from "zod";
import type { PluginOnboardingApi } from "@/types";
import { definePlugin } from "../../engine/plugins/types.js";
import { TelegramConnector, type TelegramConnectorOptions } from "./connector.js";
import { profileAvatarEnsure } from "./profileAvatarEnsure.js";
import { profileCacheDir, profileCacheFresh, profileCacheRead, profileCacheWrite } from "./profileCache.js";
import { profileFetch } from "./profileFetch.js";
import { profileRender } from "./profileRender.js";
import type { TelegramProfile } from "./profileTypes.js";

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
const PROFILE_CACHE_TTL_MS = 3_600_000;

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
        const profileMemory = new Map<string, TelegramProfile>();
        const profileFetches = new Map<string, Promise<TelegramProfile | null>>();

        const profileCachedLoad = async (telegramUserId: string): Promise<TelegramProfile | null> => {
            const inMemory = profileMemory.get(telegramUserId);
            if (inMemory) {
                return inMemory;
            }
            const cached = await profileCacheRead(profileCacheDir(api.dataDir, telegramUserId));
            if (cached) {
                profileMemory.set(telegramUserId, cached);
            }
            return cached;
        };

        const profileRefresh = async (telegramUserId: string): Promise<TelegramProfile | null> => {
            const pending = profileFetches.get(telegramUserId);
            if (pending) {
                return pending;
            }
            const task = (async () => {
                if (!connector) {
                    return null;
                }
                try {
                    const profileDir = profileCacheDir(api.dataDir, telegramUserId);
                    const previousProfile = await profileCachedLoad(telegramUserId);
                    const fetched = await profileFetch(connector.botGet(), telegramUserId, profileDir);
                    const nextAvatarFileIds = fetched.avatarFileIds ?? [];
                    const nextAvatarPaths = fetched.avatarPaths ?? [];
                    const staleAvatarPaths = profileAvatarPathsStaleResolve(previousProfile, {
                        avatarFileIds: nextAvatarFileIds,
                        avatarPaths: nextAvatarPaths
                    });
                    for (const stalePath of staleAvatarPaths) {
                        await fs.rm(stalePath, { force: true });
                    }
                    await fs.rm(path.join(profileDir, "avatar.jpg"), { force: true });
                    const profile = {
                        ...fetched,
                        avatarFileIds: nextAvatarFileIds.length > 0 ? nextAvatarFileIds : undefined,
                        avatarPaths: nextAvatarPaths.length > 0 ? nextAvatarPaths : undefined
                    };
                    await profileCacheWrite(profileDir, profile);
                    profileMemory.set(telegramUserId, profile);
                    return profile;
                } catch (error) {
                    api.logger.warn({ telegramUserId, error }, "error: Failed to refresh telegram profile");
                    return null;
                }
            })().finally(() => {
                profileFetches.delete(telegramUserId);
            });
            profileFetches.set(telegramUserId, task);
            return task;
        };
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
                profileFetches.clear();
                profileMemory.clear();
            },
            systemPrompt: async (context) => {
                const descriptor = context.descriptor;
                if (!descriptor || descriptor.type !== "user" || descriptor.connector !== "telegram") {
                    return null;
                }

                const telegramUserId = descriptor.userId;
                let profile = await profileCachedLoad(telegramUserId);
                if (!profile) {
                    profile = await profileRefresh(telegramUserId);
                    if (!profile) {
                        return null;
                    }
                } else if (!profileCacheFresh(profile, PROFILE_CACHE_TTL_MS)) {
                    void profileRefresh(telegramUserId)
                        .then(async (refreshedProfile) => {
                            if (!refreshedProfile || !context.userDownloadsDir) {
                                return;
                            }
                            try {
                                await profileAvatarEnsure(
                                    refreshedProfile.avatarPaths ?? [],
                                    context.userDownloadsDir,
                                    telegramUserId
                                );
                            } catch (error) {
                                api.logger.warn(
                                    { telegramUserId, error },
                                    "error: Failed to refresh telegram avatar copy"
                                );
                            }
                        })
                        .catch((error) => {
                            api.logger.warn({ telegramUserId, error }, "error: Telegram profile refresh failed");
                        });
                }

                let userAvatarPaths: string[] = [];
                if (context.userDownloadsDir) {
                    try {
                        userAvatarPaths = await profileAvatarEnsure(
                            profile.avatarPaths ?? [],
                            context.userDownloadsDir,
                            telegramUserId
                        );
                    } catch (error) {
                        api.logger.warn({ telegramUserId, error }, "error: Failed to ensure telegram avatar copy");
                    }
                }
                return profileRender(profile, userAvatarPaths);
            }
        };
    }
});

function profileAvatarPathsStaleResolve(
    previousProfile: TelegramProfile | null,
    nextProfile: Pick<TelegramProfile, "avatarFileIds" | "avatarPaths">
): string[] {
    if (!previousProfile) {
        return [];
    }
    const previousPaths = previousProfile.avatarPaths ?? [];
    const previousFileIds = previousProfile.avatarFileIds ?? [];
    const nextPaths = new Set((nextProfile.avatarPaths ?? []).map((avatarPath) => path.resolve(avatarPath)));
    const nextFileIds = new Set(nextProfile.avatarFileIds ?? []);
    const stalePaths = new Set<string>();
    for (let index = 0; index < previousFileIds.length; index += 1) {
        const fileId = previousFileIds[index];
        const avatarPath = previousPaths[index];
        if (!fileId || !avatarPath || nextFileIds.has(fileId)) {
            continue;
        }
        stalePaths.add(path.resolve(avatarPath));
    }
    for (const avatarPath of previousPaths) {
        const absolutePath = path.resolve(avatarPath);
        if (nextPaths.has(absolutePath)) {
            continue;
        }
        stalePaths.add(absolutePath);
    }
    return Array.from(stalePaths);
}

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
