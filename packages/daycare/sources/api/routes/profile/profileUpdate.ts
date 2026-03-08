import type { Context, UserConfiguration } from "@/types";
import { USER_CONFIGURATION_SYNC_EVENT } from "../../../engine/users/userConfigurationSyncEventBuild.js";
import type { UpdateUserInput } from "../../../storage/databaseTypes.js";
import { type ProfileUserRecord, profileRead } from "./profileRead.js";

const PROFILE_TEXT_FIELDS = ["firstName", "lastName", "bio", "about", "country", "timezone", "systemPrompt"] as const;

export type ProfileUpdateBody = {
    firstName?: string | null;
    lastName?: string | null;
    bio?: string | null;
    about?: string | null;
    country?: string | null;
    timezone?: string | null;
    systemPrompt?: string | null;
    memory?: boolean;
    configuration?: Partial<UserConfiguration>;
};

export type ProfileUpdateInput = {
    ctx: Context;
    eventBus?: {
        emit: (type: string, payload: unknown, userId?: string) => void;
    } | null;
    users: {
        findById: (id: string) => Promise<ProfileUserRecord | null>;
        update: (id: string, input: UpdateUserInput) => Promise<void>;
    };
    body: Record<string, unknown>;
};

export type ProfileUpdateResult = Awaited<ReturnType<typeof profileRead>>;

/**
 * Validates and updates mutable profile fields for the authenticated user.
 * Expects: body only contains supported profile fields with valid primitive types.
 */
export async function profileUpdate(input: ProfileUpdateInput): Promise<ProfileUpdateResult> {
    const updates: UpdateUserInput = {};
    let configurationUpdated = false;
    let currentUser: ProfileUserRecord | null = null;

    for (const field of PROFILE_TEXT_FIELDS) {
        const value = input.body[field];
        if (value === undefined) {
            continue;
        }
        if (value !== null && typeof value !== "string") {
            return { ok: false, error: `${field} must be a string or null.` };
        }
        updates[field] = value;
    }

    const memoryValue = input.body.memory;
    if (memoryValue !== undefined) {
        if (typeof memoryValue !== "boolean") {
            return { ok: false, error: "memory must be a boolean." };
        }
        updates.memory = memoryValue;
    }

    const configurationValue = input.body.configuration;
    if (configurationValue !== undefined) {
        currentUser = await input.users.findById(input.ctx.userId);
        if (!currentUser) {
            return { ok: false, error: "User not found." };
        }

        const configuration = profileConfigurationMerge(currentUser.configuration, configurationValue);
        if (!configuration.ok) {
            return configuration;
        }
        updates.configuration = configuration.configuration;
        configurationUpdated = true;
    }

    updates.updatedAt = Date.now();

    try {
        await input.users.update(input.ctx.userId, updates);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update profile.";
        return { ok: false, error: message };
    }

    const result = await profileRead({ ctx: input.ctx, users: input.users });
    if (result.ok && configurationUpdated) {
        input.eventBus?.emit(
            USER_CONFIGURATION_SYNC_EVENT,
            {
                configuration: result.profile.configuration
            },
            input.ctx.userId
        );
    }
    return result;
}

function profileConfigurationMerge(
    current: UserConfiguration,
    value: unknown
): { ok: true; configuration: UserConfiguration } | { ok: false; error: string } {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { ok: false, error: "configuration must be an object." };
    }

    const next = { ...current };
    for (const [key, entry] of Object.entries(value)) {
        if (key !== "homeReady" && key !== "appReady" && key !== "bootstrapStarted") {
            return { ok: false, error: `configuration.${key} is not supported.` };
        }
        if (typeof entry !== "boolean") {
            return { ok: false, error: `configuration.${key} must be a boolean.` };
        }
        next[key] = entry;
    }

    return { ok: true, configuration: next };
}
