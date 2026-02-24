import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { skillListUser } from "./skillListUser.js";

describe("skillListUser", () => {
    it("loads skills from user personal skills root", async () => {
        const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-user-skills-"));

        try {
            const skillDir = path.join(baseDir, "bridge-builder");
            await fs.mkdir(skillDir, { recursive: true });
            const skillPath = path.join(skillDir, "SKILL.md");
            await fs.writeFile(skillPath, "---\nname: bridge-builder\ndescription: Build bridges\n---\n\nSkill body");

            const skills = await skillListUser(baseDir);

            expect(skills).toHaveLength(1);
            const skill = skills[0];
            expect(skill?.source).toBe("user");
            expect(skill?.id).toBe("user:bridge-builder");
            expect(skill?.name).toBe("bridge-builder");
            expect(skill?.sourcePath).toBe(path.resolve(skillPath));
        } finally {
            await fs.rm(baseDir, { recursive: true, force: true });
        }
    });

    it("returns an empty list when user root is missing", async () => {
        const userRoot = path.join(os.tmpdir(), `daycare-user-skills-missing-${Date.now()}`);
        await expect(skillListUser(userRoot)).resolves.toEqual([]);
    });

    it("loads all skills from the provided personal root only", async () => {
        const userRoot = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-user-scoped-skills-"));
        const personalRoot = path.join(userRoot, "personal");
        const activeRoot = path.join(userRoot, "active");

        try {
            const systemSkillDir = path.join(personalRoot, "system-one");
            await fs.mkdir(systemSkillDir, { recursive: true });
            await fs.writeFile(
                path.join(systemSkillDir, "SKILL.md"),
                "---\nname: system-one\ndescription: System skill\n---\n\nSystem body"
            );

            const userSkillDir = path.join(personalRoot, "user-two");
            await fs.mkdir(userSkillDir, { recursive: true });
            await fs.writeFile(
                path.join(userSkillDir, "SKILL.md"),
                "---\nname: user-two\ndescription: User skill\n---\n\nUser body"
            );

            const syncedSkillDir = path.join(activeRoot, "config--skip-me");
            await fs.mkdir(syncedSkillDir, { recursive: true });
            await fs.writeFile(
                path.join(syncedSkillDir, "SKILL.md"),
                "---\nname: skip-me\ndescription: Active copy\n---\n\nActive body"
            );

            const skills = await skillListUser(personalRoot);
            const names = skills.map((skill) => skill.name).sort();
            expect(names).toEqual(["system-one", "user-two"]);
        } finally {
            await fs.rm(userRoot, { recursive: true, force: true });
        }
    });
});
