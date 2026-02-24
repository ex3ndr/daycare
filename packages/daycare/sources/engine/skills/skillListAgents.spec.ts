import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { skillListAgents } from "./skillListAgents.js";

describe("skillListAgents", () => {
    it("loads skills from ~/.agents/skills root", async () => {
        const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-agents-skills-"));

        try {
            const skillDir = path.join(baseDir, "summarize");
            await fs.mkdir(skillDir, { recursive: true });
            const skillPath = path.join(skillDir, "SKILL.md");
            await fs.writeFile(skillPath, "---\nname: summarize\ndescription: Summarize text\n---\n\nSkill body");

            const skills = await skillListAgents(baseDir);

            expect(skills).toHaveLength(1);
            const skill = skills[0];
            expect(skill?.source).toBe("agents");
            expect(skill?.id).toBe("agents:summarize");
            expect(skill?.name).toBe("summarize");
            expect(skill?.sourcePath).toBe(path.resolve(skillPath));
        } finally {
            await fs.rm(baseDir, { recursive: true, force: true });
        }
    });

    it("returns an empty list when ~/.agents/skills root is missing", async () => {
        const missingRoot = path.join(os.tmpdir(), `daycare-agents-skills-missing-${Date.now()}`);
        await expect(skillListAgents(missingRoot)).resolves.toEqual([]);
    });
});
