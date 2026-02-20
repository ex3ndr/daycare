import path from "node:path";
import { describe, expect, it } from "vitest";

import { permissionAccessApply } from "./permissionAccessApply.js";

describe("permissionAccessApply", () => {
    const basePermissions = () => ({
        workspaceDir: "/workspace",
        workingDir: "/tmp",
        writeDirs: [] as string[],
        readDirs: [] as string[],
        network: false,
        events: false
    });

    it("applies network access", () => {
        const permissions = basePermissions();
        const applied = permissionAccessApply(permissions, { kind: "network" });
        expect(applied).toBe(true);
        expect(permissions.network).toBe(true);
    });

    it("applies events access", () => {
        const permissions = basePermissions();
        const applied = permissionAccessApply(permissions, { kind: "events" });
        expect(applied).toBe(true);
        expect(permissions.events).toBe(true);
    });

    it("applies workspace access to the shared workspace root", () => {
        const permissions = {
            workspaceDir: "/workspace",
            workingDir: "/workspace/apps/my-app/data",
            writeDirs: ["/workspace/apps/my-app/data"],
            readDirs: ["/workspace"],
            network: false,
            events: false
        };
        const applied = permissionAccessApply(permissions, { kind: "workspace" });
        expect(applied).toBe(true);
        expect(permissions.writeDirs).toContain("/workspace");
        expect(permissions.readDirs).toContain("/workspace");
    });

    it("applies read/write paths", () => {
        const permissions = basePermissions();
        const readPath = path.resolve("/tmp/read");
        const writePath = path.resolve("/tmp/write");
        expect(permissionAccessApply(permissions, { kind: "read", path: readPath })).toBe(true);
        expect(permissionAccessApply(permissions, { kind: "write", path: writePath })).toBe(true);
        expect(permissions.readDirs).toContain(readPath);
        expect(permissions.readDirs).toContain(writePath);
        expect(permissions.writeDirs).toContain(writePath);
    });

    it("rejects non-absolute paths", () => {
        const permissions = basePermissions();
        const applied = permissionAccessApply(permissions, { kind: "read", path: "relative" });
        expect(applied).toBe(false);
        expect(permissions.readDirs).toHaveLength(0);
    });
});
