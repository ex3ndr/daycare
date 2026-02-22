import path from "node:path";

import { describe, expect, it } from "vitest";

import { UserHome } from "../users/userHome.js";
import { permissionBuildUser } from "./permissionBuildUser.js";

describe("permissionBuildUser", () => {
    it("builds user-scoped permissions with read-only skills roots", () => {
        const userHome = new UserHome(path.resolve("/tmp/daycare-users"), "usr_001");
        const permissions = permissionBuildUser(userHome);

        expect(permissions.workingDir).toBe(userHome.desktop);
        expect(permissions.writeDirs).toEqual([userHome.home]);
        expect(permissions.readDirs).toEqual([userHome.skills, path.resolve("/tmp/daycare-users/skills")]);
    });
});
