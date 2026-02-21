import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { UserHome } from "./userHome.js";
import { userHomeEnsure } from "./userHomeEnsure.js";

describe("userHomeEnsure", () => {
    let rootDir: string;

    beforeEach(async () => {
        rootDir = await mkdtemp(path.join(os.tmpdir(), "daycare-user-home-"));
    });

    afterEach(async () => {
        await rm(rootDir, { recursive: true, force: true });
    });

    it("creates all user directories and seeds knowledge files", async () => {
        const userHome = new UserHome(path.join(rootDir, "users"), "usr_abc");
        await userHomeEnsure(userHome);

        const expectedDirs = [
            userHome.root,
            userHome.skills,
            userHome.apps,
            userHome.home,
            userHome.desktop,
            userHome.downloads,
            userHome.documents,
            userHome.developer,
            userHome.knowledge,
            userHome.tmp
        ];
        for (const dir of expectedDirs) {
            const dirStat = await stat(dir);
            expect(dirStat.isDirectory()).toBe(true);
        }

        const knowledgePaths = userHome.knowledgePaths();
        const filePaths = [
            knowledgePaths.soulPath,
            knowledgePaths.userPath,
            knowledgePaths.agentsPath,
            knowledgePaths.toolsPath
        ];
        for (const filePath of filePaths) {
            const fileStat = await stat(filePath);
            expect(fileStat.isFile()).toBe(true);
            const content = await readFile(filePath, "utf8");
            expect(content.trim().length).toBeGreaterThan(0);
        }
    });

    it("is idempotent when run multiple times", async () => {
        const userHome = new UserHome(path.join(rootDir, "users"), "usr_repeat");
        await userHomeEnsure(userHome);
        await userHomeEnsure(userHome);

        const knowledgePaths = userHome.knowledgePaths();
        const soulContent = await readFile(knowledgePaths.soulPath, "utf8");
        expect(soulContent.trim().length).toBeGreaterThan(0);
    });
});
