import { mkdtemp, rm, stat } from "node:fs/promises";
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

    it("creates all user directories", async () => {
        const userHome = new UserHome(path.join(rootDir, "users"), "usr_abc");
        await userHomeEnsure(userHome);

        const expectedDirs = [
            userHome.root,
            userHome.skills,
            userHome.skillsPersonal,
            userHome.skillsActive,
            userHome.home,
            userHome.databases,
            userHome.desktop,
            userHome.downloads,
            userHome.documents,
            userHome.developer,
            userHome.tmp
        ];
        for (const dir of expectedDirs) {
            const dirStat = await stat(dir);
            expect(dirStat.isDirectory()).toBe(true);
        }
    });

    it("is idempotent when run multiple times", async () => {
        const userHome = new UserHome(path.join(rootDir, "users"), "usr_repeat");
        await userHomeEnsure(userHome);
        await userHomeEnsure(userHome);

        const tmpStat = await stat(userHome.tmp);
        expect(tmpStat.isDirectory()).toBe(true);
    });
});
