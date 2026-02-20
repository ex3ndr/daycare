import { describe, expect, it } from "vitest";

import type { SessionPermissions } from "../permissions.js";
import { permissionEnsureDefaultFile } from "./permissionEnsureDefaultFile.js";

describe("permissionEnsureDefaultFile", () => {
    it("merges default read/write directories", () => {
        const permissions: SessionPermissions = {
            workingDir: "/workspace",
            writeDirs: ["/write"],
            readDirs: ["/read"],
            network: false,
            events: false
        };

        permissionEnsureDefaultFile(permissions, {
            writeDirs: ["/write", "/extra-write"],
            readDirs: ["/read", "/extra-read"]
        });

        expect(permissions.writeDirs).toEqual(expect.arrayContaining(["/write", "/extra-write"]));
        expect(permissions.readDirs).toEqual(expect.arrayContaining(["/read", "/extra-read"]));
    });
});
