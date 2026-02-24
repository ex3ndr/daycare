import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type TelegramBot from "node-telegram-bot-api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { profileFetch } from "./profileFetch.js";

type TelegramBotProfileMock = {
    getChat: ReturnType<typeof vi.fn>;
    getUserProfilePhotos: ReturnType<typeof vi.fn>;
    downloadFile: ReturnType<typeof vi.fn>;
};

function botBuild(): TelegramBotProfileMock {
    return {
        getChat: vi.fn(),
        getUserProfilePhotos: vi.fn(),
        downloadFile: vi.fn()
    };
}

const tempDirs: string[] = [];

async function tempDirCreate(): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-telegram-profile-fetch-"));
    tempDirs.push(dir);
    return dir;
}

describe("profileFetch", () => {
    afterEach(async () => {
        for (const dir of tempDirs.splice(0, tempDirs.length)) {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("fetches profile fields and downloads all avatar photos", async () => {
        const downloadDir = await tempDirCreate();
        const sourceA = path.join(downloadDir, "downloaded-a.jpg");
        const sourceB = path.join(downloadDir, "downloaded-b.jpg");
        await writeFile(sourceA, "avatar-a", "utf8");
        await writeFile(sourceB, "avatar-b", "utf8");
        const bot = botBuild();
        bot.getChat.mockResolvedValue({
            id: 123,
            type: "private",
            first_name: "Ada",
            last_name: "Lovelace",
            username: "ada",
            bio: "Math pioneer",
            phone_number: "+1-555-0100"
        });
        bot.getUserProfilePhotos.mockResolvedValue({
            total_count: 2,
            photos: [
                [{ file_id: "avatar-1-small" }, { file_id: "avatar-1-large" }],
                [{ file_id: "avatar-2-small" }, { file_id: "avatar-2-large" }]
            ]
        });
        bot.downloadFile.mockResolvedValueOnce(sourceA).mockResolvedValueOnce(sourceB);

        const result = await profileFetch(bot as unknown as TelegramBot, "123", downloadDir);

        expect(result.telegramUserId).toBe("123");
        expect(result.firstName).toBe("Ada");
        expect(result.lastName).toBe("Lovelace");
        expect(result.username).toBe("ada");
        expect(result.bio).toBe("Math pioneer");
        expect(result.phone).toBe("+1-555-0100");
        expect(result.avatarFileIds).toEqual(["avatar-1-small", "avatar-2-small"]);
        expect(result.avatarPaths).toEqual([
            path.join(downloadDir, "avatar-avatar-1-small.jpg"),
            path.join(downloadDir, "avatar-avatar-2-small.jpg")
        ]);
        expect(result.fetchedAt).toBeTypeOf("number");
        expect(bot.getUserProfilePhotos).toHaveBeenCalledWith(123, { offset: 0, limit: 100 });
        expect(bot.downloadFile).toHaveBeenNthCalledWith(1, "avatar-1-small", expect.any(String));
        expect(bot.downloadFile).toHaveBeenNthCalledWith(2, "avatar-2-small", expect.any(String));
    });

    it("returns a safe fallback profile when telegram API calls fail", async () => {
        const bot = botBuild();
        bot.getChat.mockRejectedValue(new Error("chat failed"));
        bot.getUserProfilePhotos.mockRejectedValue(new Error("photo failed"));

        const result = await profileFetch(
            bot as unknown as TelegramBot,
            "321",
            path.join(os.tmpdir(), "daycare-telegram-profile-test")
        );

        expect(result).toEqual({
            telegramUserId: "321",
            firstName: "321",
            fetchedAt: result.fetchedAt
        });
        expect(result.avatarFileIds).toBeUndefined();
        expect(result.avatarPaths).toBeUndefined();
        expect(bot.downloadFile).not.toHaveBeenCalled();
    });
});
