import path from "node:path";

import { describe, expect, it } from "vitest";

import { UserHome } from "./userHome.js";

describe("UserHome", () => {
    it("resolves all user directories from usersDir and userId", () => {
        const usersDir = path.resolve("/tmp/daycare-users");
        const userHome = new UserHome(usersDir, "usr_123");

        expect(userHome.root).toBe(path.join(usersDir, "usr_123"));
        expect(userHome.skills).toBe(path.join(usersDir, "usr_123", "skills"));
        expect(userHome.apps).toBe(path.join(usersDir, "usr_123", "apps"));
        expect(userHome.home).toBe(path.join(usersDir, "usr_123", "home"));
        expect(userHome.desktop).toBe(path.join(usersDir, "usr_123", "home", "desktop"));
        expect(userHome.downloads).toBe(path.join(usersDir, "usr_123", "home", "downloads"));
        expect(userHome.documents).toBe(path.join(usersDir, "usr_123", "home", "documents"));
        expect(userHome.developer).toBe(path.join(usersDir, "usr_123", "home", "developer"));
        expect(userHome.knowledge).toBe(path.join(usersDir, "usr_123", "home", "knowledge"));
        expect(userHome.tmp).toBe(path.join(usersDir, "usr_123", "home", "tmp"));
    });

    it("returns knowledge prompt file paths from the knowledge folder", () => {
        const userHome = new UserHome("/tmp/daycare-users", "usr_456");
        expect(userHome.knowledgePaths()).toEqual({
            soulPath: path.join(userHome.knowledge, "SOUL.md"),
            userPath: path.join(userHome.knowledge, "USER.md"),
            agentsPath: path.join(userHome.knowledge, "AGENTS.md"),
            toolsPath: path.join(userHome.knowledge, "TOOLS.md")
        });
    });
});
