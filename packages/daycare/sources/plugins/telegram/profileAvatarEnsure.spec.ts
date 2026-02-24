import { mkdtemp, readdir, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { profileAvatarEnsure } from "./profileAvatarEnsure.js";

const tempDirs: string[] = [];

async function tempDirCreate(): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-telegram-avatar-"));
    tempDirs.push(dir);
    return dir;
}

describe("profileAvatarEnsure", () => {
    afterEach(async () => {
        for (const dir of tempDirs.splice(0, tempDirs.length)) {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("returns an empty array when cached avatars are missing", async () => {
        const dir = await tempDirCreate();
        const result = await profileAvatarEnsure([path.join(dir, "missing.jpg")], path.join(dir, "downloads"), "123");
        expect(result).toEqual([]);
    });

    it("copies source avatars when user copies are missing", async () => {
        const dir = await tempDirCreate();
        const sourceA = path.join(dir, "avatar-a.jpg");
        const sourceB = path.join(dir, "avatar-b.jpg");
        await writeFile(sourceA, "avatar-a-v1", "utf8");
        await writeFile(sourceB, "avatar-b-v1", "utf8");

        const targets = await profileAvatarEnsure([sourceA, sourceB], path.join(dir, "downloads"), "123");

        expect(targets).toEqual([
            path.join(dir, "downloads", "profile-telegram-123-avatar-a.jpg"),
            path.join(dir, "downloads", "profile-telegram-123-avatar-b.jpg")
        ]);
        expect(await readFile(targets[0]!, "utf8")).toBe("avatar-a-v1");
        expect(await readFile(targets[1]!, "utf8")).toBe("avatar-b-v1");
    });

    it("does not recopy when targets are up to date", async () => {
        const dir = await tempDirCreate();
        const source = path.join(dir, "avatar.jpg");
        const downloads = path.join(dir, "downloads");
        await writeFile(source, "avatar-v1", "utf8");
        const first = await profileAvatarEnsure([source], downloads, "123");
        const before = await stat(first[0]!);

        const second = await profileAvatarEnsure([source], downloads, "123");
        const after = await stat(second[0]!);

        expect(second).toEqual(first);
        expect(after.mtimeMs).toBe(before.mtimeMs);
    });

    it("recopies when source has changed", async () => {
        const dir = await tempDirCreate();
        const source = path.join(dir, "avatar.jpg");
        const downloads = path.join(dir, "downloads");
        await writeFile(source, "avatar-v1", "utf8");
        const targets = await profileAvatarEnsure([source], downloads, "123");
        expect(await readFile(targets[0]!, "utf8")).toBe("avatar-v1");

        const future = new Date(Date.now() + 10_000);
        await writeFile(source, "avatar-v2", "utf8");
        await utimes(source, future, future);

        await profileAvatarEnsure([source], downloads, "123");

        expect(await readFile(targets[0]!, "utf8")).toBe("avatar-v2");
    });

    it("removes stale user copies when avatar set shrinks", async () => {
        const dir = await tempDirCreate();
        const sourceA = path.join(dir, "avatar-a.jpg");
        const sourceB = path.join(dir, "avatar-b.jpg");
        const downloads = path.join(dir, "downloads");
        await writeFile(sourceA, "avatar-a-v1", "utf8");
        await writeFile(sourceB, "avatar-b-v1", "utf8");

        await profileAvatarEnsure([sourceA, sourceB], downloads, "123");
        await profileAvatarEnsure([sourceA], downloads, "123");

        const files = await readdir(downloads);
        expect(files).toEqual(["profile-telegram-123-avatar-a.jpg"]);
    });
});
