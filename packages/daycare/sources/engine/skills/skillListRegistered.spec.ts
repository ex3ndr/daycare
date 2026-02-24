import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { skillListRegistered } from "./skillListRegistered.js";

describe("skillListRegistered", () => {
    it("dedupes registrations and tags plugin metadata", async () => {
        const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-skills-"));
        try {
            const pluginSkillDir = path.join(baseDir, "plugin-skill");
            await fs.mkdir(pluginSkillDir, { recursive: true });

            const pluginSkillPath = path.join(pluginSkillDir, "SKILL.md");
            await fs.writeFile(
                pluginSkillPath,
                "---\nname: plugin-skill\ndescription: Manage <xml> safely\n---\n\nPlugin skill"
            );

            const skills = await skillListRegistered([
                { pluginId: "alpha", path: pluginSkillPath },
                { pluginId: "alpha", path: pluginSkillPath }
            ]);

            expect(skills).toHaveLength(1);
            const skill = skills[0];
            expect(skill?.source).toBe("plugin");
            expect(skill?.pluginId).toBe("alpha");
            expect(skill?.id).toBe("plugin:alpha/plugin-skill");
            expect(skill?.sourcePath).toBe(path.resolve(pluginSkillPath));
        } finally {
            await fs.rm(baseDir, { recursive: true, force: true });
        }
    });
});
