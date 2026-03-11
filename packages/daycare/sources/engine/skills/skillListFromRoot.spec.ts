import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { skillListFromRoot } from "./skillListFromRoot.js";

describe("skillListFromRoot", () => {
    it("collects skill metadata from frontmatter and nested categories", async () => {
        const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-skills-"));
        try {
            const coreRoot = path.join(baseDir, "core");
            const categoryDir = path.join(coreRoot, "software-development");
            await fs.mkdir(categoryDir, { recursive: true });
            await fs.writeFile(path.join(categoryDir, "DESCRIPTION.md"), "# Category notes");
            const coreSkillDir = path.join(categoryDir, "deploy");
            await fs.mkdir(coreSkillDir, { recursive: true });

            const coreSkillPath = path.join(coreSkillDir, "SKILL.md");
            await fs.writeFile(coreSkillPath, '---\nname: deploy\ndescription: "Use <cron>"\n---\n\nCore skill');

            const skills = await skillListFromRoot(coreRoot, {
                source: "core",
                root: coreRoot
            });

            expect(skills).toHaveLength(1);
            const skill = skills[0];
            expect(skill?.id).toBe("core:software-development/deploy");
            expect(skill?.name).toBe("deploy");
            expect(skill?.category).toBe("software-development");
            expect(skill?.description).toBe("Use <cron>");
            expect(skill?.sourcePath).toBe(path.resolve(coreSkillPath));
        } finally {
            await fs.rm(baseDir, { recursive: true, force: true });
        }
    });
});
