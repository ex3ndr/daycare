import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { skillsContent } from "./skillsContent.js";

const tmpPaths: string[] = [];

afterEach(async () => {
    for (const tmpPath of tmpPaths.splice(0, tmpPaths.length)) {
        await fs.rm(tmpPath, { recursive: true, force: true });
    }
});

describe("skillsContent", () => {
    it("returns skill content when found", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-content-"));
        tmpPaths.push(tmpDir);
        const skillPath = path.join(tmpDir, "SKILL.md");
        await fs.writeFile(skillPath, "# My Skill\n");

        const result = await skillsContent({
            skillId: "user:my-skill",
            skills: {
                list: async () => [
                    {
                        id: "user:my-skill",
                        name: "My Skill",
                        description: null,
                        source: "user",
                        sourcePath: skillPath
                    }
                ]
            }
        });

        expect(result).toEqual({
            ok: true,
            skill: {
                id: "user:my-skill",
                name: "My Skill",
                description: null
            },
            content: "# My Skill\n"
        });
    });

    it("returns not found when skill id is unknown", async () => {
        const result = await skillsContent({
            skillId: "user:missing",
            skills: {
                list: async () => []
            }
        });

        expect(result).toEqual({ ok: false, error: "Skill not found." });
    });

    it("returns file read errors", async () => {
        const result = await skillsContent({
            skillId: "user:my-skill",
            skills: {
                list: async () => [
                    {
                        id: "user:my-skill",
                        name: "My Skill",
                        description: null,
                        source: "user",
                        sourcePath: "/does/not/exist/SKILL.md"
                    }
                ]
            }
        });

        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error("Expected error result.");
        }
        expect(result.error.length).toBeGreaterThan(0);
    });
});
