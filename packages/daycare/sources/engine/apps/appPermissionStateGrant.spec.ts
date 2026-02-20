import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { appPermissionStateGrant } from "./appPermissionStateGrant.js";
import { appPermissionStatePathBuild } from "./appPermissionStatePathBuild.js";
import { appPermissionStateRead } from "./appPermissionStateRead.js";

describe("appPermissionStateGrant", () => {
    let workspaceDir: string;

    beforeEach(async () => {
        workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-app-state-"));
    });

    afterEach(async () => {
        await fs.rm(workspaceDir, { recursive: true, force: true });
    });

    it("persists shared app permissions in app workspace state.json", async () => {
        await appPermissionStateGrant(workspaceDir, "github-reviewer", { kind: "workspace" });
        await appPermissionStateGrant(workspaceDir, "github-reviewer", { kind: "network" });
        await appPermissionStateGrant(workspaceDir, "github-reviewer", {
            kind: "read",
            path: "/tmp/daycare-app-read"
        });
        await appPermissionStateGrant(workspaceDir, "github-reviewer", {
            kind: "network"
        });

        const statePath = appPermissionStatePathBuild(workspaceDir, "github-reviewer");
        const stat = await fs.stat(statePath);
        expect(stat.isFile()).toBe(true);

        const tags = await appPermissionStateRead(workspaceDir, "github-reviewer");
        expect(tags).toEqual(["@workspace", "@network", "@read:/tmp/daycare-app-read"]);
    });
});
