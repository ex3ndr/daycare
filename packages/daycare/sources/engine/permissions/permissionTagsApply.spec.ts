import { describe, expect, it } from "vitest";

import { permissionTagsApply } from "./permissionTagsApply.js";

describe("permissionTagsApply", () => {
    it("applies tags to permissions", () => {
        const permissions = {
            workspaceDir: "/workspace",
            workingDir: "/tmp",
            writeDirs: [],
            readDirs: [],
            network: false,
            events: false
        };
        permissionTagsApply(permissions, ["@network", "@events", "@workspace", "@read:/tmp", "@write:/var/tmp"]);
        expect(permissions.network).toBe(true);
        expect(permissions.events).toBe(true);
        expect(permissions.writeDirs).toContain("/workspace");
        expect(permissions.readDirs).toContain("/tmp");
        expect(permissions.readDirs).toContain("/var/tmp");
        expect(permissions.writeDirs).toContain("/var/tmp");
    });
});
