import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

const mockedPaths = vi.hoisted(() => ({ userSkillsRoot: "" }));

vi.mock("../../paths.js", () => ({
    get DEFAULT_USER_SKILLS_ROOT() {
        return mockedPaths.userSkillsRoot;
    }
}));

import { skillListUser } from "./skillListUser.js";

describe("skillListUser", () => {
    it("loads skills from ~/.agents/skills", async () => {
        const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-user-skills-"));
        mockedPaths.userSkillsRoot = baseDir;

        try {
            const skillDir = path.join(baseDir, "bridge-builder");
            await fs.mkdir(skillDir, { recursive: true });
            const skillPath = path.join(skillDir, "SKILL.md");
            await fs.writeFile(skillPath, "---\nname: bridge-builder\ndescription: Build bridges\n---\n\nSkill body");

            const skills = await skillListUser();

            expect(skills).toHaveLength(1);
            const skill = skills[0];
            expect(skill?.source).toBe("user");
            expect(skill?.id).toBe("user:bridge-builder");
            expect(skill?.name).toBe("bridge-builder");
            expect(skill?.path).toBe(path.resolve(skillPath));
        } finally {
            await fs.rm(baseDir, { recursive: true, force: true });
        }
    });

    it("returns an empty list when ~/.agents/skills is missing", async () => {
        mockedPaths.userSkillsRoot = path.join(os.tmpdir(), `daycare-user-skills-missing-${Date.now()}`);
        await expect(skillListUser()).resolves.toEqual([]);
    });
});
