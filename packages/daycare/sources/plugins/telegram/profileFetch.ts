import { promises as fs } from "node:fs";
import path from "node:path";
import type TelegramBot from "node-telegram-bot-api";
import type { TelegramProfile } from "./profileTypes.js";

/**
 * Fetches Telegram user profile data and downloads all available avatars when present.
 * Expects: telegramUserId identifies a private Telegram user chat.
 */
export async function profileFetch(
    bot: TelegramBot,
    telegramUserId: string,
    downloadDir: string
): Promise<TelegramProfile> {
    const fetchedAt = Date.now();
    const profile: TelegramProfile = {
        telegramUserId,
        firstName: telegramUserId,
        fetchedAt
    };

    try {
        const chat = await bot.getChat(telegramUserId);
        const firstName = "first_name" in chat && typeof chat.first_name === "string" ? chat.first_name.trim() : "";
        const lastName = "last_name" in chat && typeof chat.last_name === "string" ? chat.last_name.trim() : "";
        const username = "username" in chat && typeof chat.username === "string" ? chat.username.trim() : "";
        const bio = "bio" in chat && typeof chat.bio === "string" ? chat.bio.trim() : "";
        const phone = "phone_number" in chat && typeof chat.phone_number === "string" ? chat.phone_number.trim() : "";
        profile.firstName = firstName || username || telegramUserId;
        if (lastName) {
            profile.lastName = lastName;
        }
        if (username) {
            profile.username = username;
        }
        if (bio) {
            profile.bio = bio;
        }
        if (phone) {
            profile.phone = phone;
        }
    } catch {}

    try {
        const numericUserId = Number(telegramUserId);
        if (!Number.isFinite(numericUserId)) {
            return profile;
        }
        const avatarFileIds = await profileAvatarFileIdsFetch(bot, numericUserId);
        const avatarPaths: string[] = [];
        await fs.mkdir(downloadDir, { recursive: true });
        for (const fileId of avatarFileIds) {
            const downloadedPath = await bot.downloadFile(fileId, downloadDir);
            const stablePath = path.join(downloadDir, `avatar-${profileAvatarFileIdSanitize(fileId)}.jpg`);
            if (path.resolve(downloadedPath) !== path.resolve(stablePath)) {
                await fs.copyFile(downloadedPath, stablePath);
                await fs.rm(downloadedPath, { force: true });
            }
            avatarPaths.push(stablePath);
        }
        if (avatarFileIds.length > 0) {
            profile.avatarFileIds = avatarFileIds;
            profile.avatarPaths = avatarPaths;
        }
    } catch {}

    return profile;
}

async function profileAvatarFileIdsFetch(bot: TelegramBot, userId: number): Promise<string[]> {
    const fileIds: string[] = [];
    const seen = new Set<string>();
    let offset = 0;
    for (;;) {
        const photos = await bot.getUserProfilePhotos(userId, { offset, limit: 100 });
        if (!photos.photos || photos.photos.length === 0) {
            break;
        }
        for (const avatar of photos.photos) {
            // Telegram stores each avatar as multiple sizes; use the first entry to avoid size-based selection.
            const fileId = avatar[0]?.file_id;
            if (!fileId || seen.has(fileId)) {
                continue;
            }
            seen.add(fileId);
            fileIds.push(fileId);
        }
        offset += photos.photos.length;
        if (offset >= photos.total_count) {
            break;
        }
    }
    return fileIds;
}

function profileAvatarFileIdSanitize(fileId: string): string {
    return fileId.replace(/[^A-Za-z0-9_-]/g, "_");
}
