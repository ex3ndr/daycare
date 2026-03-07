import path from "node:path";

import { describe, expect, it } from "vitest";

import { UserHome } from "./userHome.js";

describe("UserHome", () => {
    it("resolves all user directories from usersDir and userId", () => {
        const usersDir = path.resolve("/tmp/daycare-users");
        const userHome = new UserHome(usersDir, "usr_123");

        expect(userHome.root).toBe(path.join(usersDir, "usr_123"));
        expect(userHome.skills).toBe(path.join(usersDir, "usr_123", "skills"));
        expect(userHome.skillsPersonal).toBe(path.join(usersDir, "usr_123", "skills", "personal"));
        expect(userHome.skillsActive).toBe(path.join(usersDir, "usr_123", "skills", "active"));
        expect(userHome.home).toBe(path.join(usersDir, "usr_123", "home"));
        expect(userHome.databases).toBe(path.join(usersDir, "usr_123", "databases"));
        expect(userHome.desktop).toBe(path.join(usersDir, "usr_123", "home", "desktop"));
        expect(userHome.downloads).toBe(path.join(usersDir, "usr_123", "home", "downloads"));
        expect(userHome.documents).toBe(path.join(usersDir, "usr_123", "home", "documents"));
        expect(userHome.developer).toBe(path.join(usersDir, "usr_123", "home", "developer"));
        expect(userHome.tmp).toBe(path.join(usersDir, "usr_123", "home", "tmp"));
    });
});
