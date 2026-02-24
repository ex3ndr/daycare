import { promises as fs } from "node:fs";
import path from "node:path";
import type { TelegramProfile } from "./profileTypes.js";

/**
 * Reads a cached Telegram profile from disk.
 * Expects: profileDir follows the profile cache layout.
 */
export async function profileCacheRead(profileDir: string): Promise<TelegramProfile | null> {
    const profilePath = path.join(profileDir, "profile.json");
    try {
        const raw = await fs.readFile(profilePath, "utf8");
        return profileCacheNormalize(JSON.parse(raw) as TelegramProfile & { avatarPath?: string });
    } catch {
        return null;
    }
}

/**
 * Writes a Telegram profile JSON snapshot to disk.
 * Expects: profile.fetchedAt is a unix timestamp in milliseconds.
 */
export async function profileCacheWrite(profileDir: string, profile: TelegramProfile): Promise<void> {
    await fs.mkdir(profileDir, { recursive: true });
    await fs.writeFile(path.join(profileDir, "profile.json"), JSON.stringify(profile, null, 2), "utf8");
}

/**
 * Returns true when a cached profile is fresh for the provided TTL.
 * Expects: ttlMs is non-negative.
 */
export function profileCacheFresh(profile: TelegramProfile, ttlMs: number): boolean {
    return profile.fetchedAt + ttlMs > Date.now();
}

/**
 * Resolves the profile cache directory for a Telegram user.
 * Expects: dataDir is an absolute plugin data directory.
 */
export function profileCacheDir(dataDir: string, telegramUserId: string): string {
    return path.join(dataDir, "profiles", telegramUserId);
}

function profileCacheNormalize(profile: TelegramProfile & { avatarPath?: string }): TelegramProfile {
    if (!profile.avatarPaths && profile.avatarPath) {
        return {
            ...profile,
            avatarPaths: [profile.avatarPath]
        };
    }
    return profile;
}
