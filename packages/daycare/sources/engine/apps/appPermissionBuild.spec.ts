import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { appPermissionBuild } from "./appPermissionBuild.js";

describe("appPermissionBuild", () => {
    let appsDir: string;

    beforeEach(async () => {
        appsDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-app-permissions-"));
    });

    afterEach(async () => {
        await fs.rm(appsDir, { recursive: true, force: true });
    });

    it("builds app-scoped permissions and creates data dir", async () => {
        const permissions = await appPermissionBuild(appsDir, "github-reviewer");
        const expectedDataDir = path.join(appsDir, "github-reviewer", "data");

        expect(permissions).toEqual({
            workingDir: expectedDataDir,
            writeDirs: [expectedDataDir]
        });

        const stat = await fs.stat(expectedDataDir);
        expect(stat.isDirectory()).toBe(true);
    });

    it("returns a fixed app-local permission set", async () => {
        const permissions = await appPermissionBuild(appsDir, "github-reviewer");
        expect(permissions).toEqual({
            workingDir: path.join(appsDir, "github-reviewer", "data"),
            writeDirs: [path.join(appsDir, "github-reviewer", "data")]
        });
    });
});
