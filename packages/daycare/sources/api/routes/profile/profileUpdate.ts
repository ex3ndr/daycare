import type { Context } from "@/types";
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
};

export type ProfileUpdateInput = {
    ctx: Context;
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

    updates.updatedAt = Date.now();

    try {
        await input.users.update(input.ctx.userId, updates);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update profile.";
        return { ok: false, error: message };
    }

    return profileRead({ ctx: input.ctx, users: input.users });
}
