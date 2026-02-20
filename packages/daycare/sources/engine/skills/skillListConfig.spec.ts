import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { skillListConfig } from "./skillListConfig.js";

describe("skillListConfig", () => {
    it("loads skills from the configured skills root", async () => {
        const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-skills-"));
        try {
            const skillDir = path.join(baseDir, "holocube");
            await fs.mkdir(skillDir, { recursive: true });
            const skillPath = path.join(skillDir, "SKILL.md");
            await fs.writeFile(
                skillPath,
                "---\nname: holocube\ndescription: Draw to the cube display\n---\n\nSkill body"
            );

            const skills = await skillListConfig(baseDir);

            expect(skills).toHaveLength(1);
            const skill = skills[0];
            expect(skill?.source).toBe("config");
            expect(skill?.id).toBe("config:holocube");
            expect(skill?.name).toBe("holocube");
            expect(skill?.path).toBe(path.resolve(skillPath));
        } finally {
            await fs.rm(baseDir, { recursive: true, force: true });
        }
    });

    it("returns an empty list when the config skills directory is missing", async () => {
        const missingRoot = path.join(os.tmpdir(), `daycare-skills-missing-${Date.now()}`);
        await expect(skillListConfig(missingRoot)).resolves.toEqual([]);
    });
});
