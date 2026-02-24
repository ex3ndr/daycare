import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { profileCacheDir, profileCacheFresh, profileCacheRead, profileCacheWrite } from "./profileCache.js";
import type { TelegramProfile } from "./profileTypes.js";

const tempDirs: string[] = [];

async function tempDirCreate(): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-telegram-cache-"));
    tempDirs.push(dir);
    return dir;
}

describe("profileCache", () => {
    afterEach(async () => {
        for (const dir of tempDirs.splice(0, tempDirs.length)) {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("returns null when cache is missing", async () => {
        const dir = await tempDirCreate();
        const cached = await profileCacheRead(path.join(dir, "profiles", "1"));
        expect(cached).toBeNull();
    });

    it("writes and reads profile cache roundtrip", async () => {
        const dir = await tempDirCreate();
        const profileDir = profileCacheDir(dir, "42");
        const profile: TelegramProfile = {
            telegramUserId: "42",
            firstName: "Grace",
            username: "grace",
            fetchedAt: Date.now()
        };

        await profileCacheWrite(profileDir, profile);
        const cached = await profileCacheRead(profileDir);

        expect(cached).toEqual(profile);
    });

    it("normalizes legacy avatarPath into avatarPaths", async () => {
        const dir = await tempDirCreate();
        const profileDir = profileCacheDir(dir, "43");
        await mkdir(profileDir, { recursive: true });
        await writeFile(
            path.join(profileDir, "profile.json"),
            JSON.stringify({
                telegramUserId: "43",
                firstName: "Legacy",
                avatarPath: "/tmp/legacy-avatar.jpg",
                fetchedAt: Date.now()
            }),
            "utf8"
        );

        const cached = await profileCacheRead(profileDir);

        expect(cached?.avatarPaths).toEqual(["/tmp/legacy-avatar.jpg"]);
    });

    it("checks profile freshness by ttl", () => {
        const now = Date.now();
        expect(
            profileCacheFresh(
                {
                    telegramUserId: "fresh",
                    firstName: "Fresh",
                    fetchedAt: now - 1_000
                },
                3_600_000
            )
        ).toBe(true);
        expect(
            profileCacheFresh(
                {
                    telegramUserId: "stale",
                    firstName: "Stale",
                    fetchedAt: now - 10_000
                },
                1_000
            )
        ).toBe(false);
    });
});
