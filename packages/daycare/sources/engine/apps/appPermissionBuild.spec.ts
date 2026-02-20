import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { appPermissionBuild } from "./appPermissionBuild.js";
import { appPermissionStateWrite } from "./appPermissionStateWrite.js";

describe("appPermissionBuild", () => {
    let workspaceDir: string;

    beforeEach(async () => {
        workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-app-permissions-"));
    });

    afterEach(async () => {
        await fs.rm(workspaceDir, { recursive: true, force: true });
    });

    it("builds app-scoped permissions and creates data dir", async () => {
        const permissions = await appPermissionBuild(workspaceDir, "github-reviewer");
        const expectedDataDir = path.join(workspaceDir, "apps", "github-reviewer", "data");

        expect(permissions).toEqual({
            workspaceDir: path.resolve(workspaceDir),
            workingDir: expectedDataDir,
            writeDirs: [expectedDataDir],
            readDirs: [path.resolve(workspaceDir)],
            network: false,
            events: false
        });

        const stat = await fs.stat(expectedDataDir);
        expect(stat.isDirectory()).toBe(true);
    });

    it("merges shared app permissions persisted in app state", async () => {
        await appPermissionStateWrite(workspaceDir, "github-reviewer", [
            "@workspace",
            "@network",
            "@read:/tmp/daycare-app-read",
            "@write:/tmp/daycare-app-write"
        ]);

        const permissions = await appPermissionBuild(workspaceDir, "github-reviewer");
        expect(permissions.network).toBe(true);
        expect(permissions.readDirs).toContain("/tmp/daycare-app-read");
        expect(permissions.readDirs).toContain("/tmp/daycare-app-write");
        expect(permissions.writeDirs).toContain(path.resolve(workspaceDir));
        expect(permissions.writeDirs).toContain("/tmp/daycare-app-write");
    });
});
