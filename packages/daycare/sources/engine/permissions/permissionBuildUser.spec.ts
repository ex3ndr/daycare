import path from "node:path";

import { describe, expect, it } from "vitest";

import { UserHome } from "../users/userHome.js";
import { permissionBuildUser } from "./permissionBuildUser.js";

describe("permissionBuildUser", () => {
    it("builds user-scoped permissions with read-only skills and writable knowledge files", () => {
        const userHome = new UserHome(path.resolve("/tmp/daycare-users"), "usr_001");
        const permissions = permissionBuildUser(userHome);
        const knowledgePaths = userHome.knowledgePaths();

        expect(permissions.workspaceDir).toBe(userHome.home);
        expect(permissions.workingDir).toBe(userHome.desktop);
        expect(permissions.writeDirs).toEqual(
            expect.arrayContaining([
                userHome.desktop,
                userHome.downloads,
                userHome.documents,
                userHome.developer,
                userHome.tmp,
                knowledgePaths.soulPath,
                knowledgePaths.userPath,
                knowledgePaths.agentsPath,
                knowledgePaths.toolsPath
            ])
        );
        expect(permissions.readDirs).toEqual(expect.arrayContaining(permissions.writeDirs));
        expect(permissions.readDirs).toContain(userHome.skills);
        expect(permissions.writeDirs).not.toContain(userHome.skills);
        expect(permissions.readDirs).not.toContain(userHome.apps);
        expect(permissions.writeDirs).not.toContain(userHome.apps);
        expect(permissions.network).toBe(false);
        expect(permissions.events).toBe(false);
    });
});
