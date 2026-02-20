import { describe, expect, it } from "vitest";

import { permissionWorkspacePathResolve } from "./permissionWorkspacePathResolve.js";

describe("permissionWorkspacePathResolve", () => {
    it("prefers explicit workspaceDir when present", () => {
        const result = permissionWorkspacePathResolve({
            workspaceDir: "/workspace",
            workingDir: "/workspace/apps/my-app/data",
            writeDirs: ["/workspace/apps/my-app/data"],
            readDirs: ["/workspace"],
            network: false,
            events: false
        });
        expect(result).toBe("/workspace");
    });

    it("derives workspace root from app workingDir when workspaceDir is missing", () => {
        const result = permissionWorkspacePathResolve({
            workingDir: "/workspace/apps/my-app/data",
            writeDirs: ["/workspace/apps/my-app/data"],
            readDirs: ["/workspace"],
            network: false,
            events: false
        });
        expect(result).toBe("/workspace");
    });

    it("falls back to closest ancestor permission root for cron-like workingDir", () => {
        const result = permissionWorkspacePathResolve({
            workingDir: "/workspace/cron/my-task/files",
            writeDirs: ["/workspace"],
            readDirs: ["/workspace"],
            network: false,
            events: false
        });
        expect(result).toBe("/workspace");
    });
});
