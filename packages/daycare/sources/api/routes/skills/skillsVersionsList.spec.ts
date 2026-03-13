import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { skillsVersionsList } from "./skillsVersionsList.js";

const tmpPaths: string[] = [];

afterEach(async () => {
    for (const tmpPath of tmpPaths.splice(0, tmpPaths.length)) {
        await fs.rm(tmpPath, { recursive: true, force: true });
    }
});

describe("skillsVersionsList", () => {
    it("lists previous versions for a user skill", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-versions-"));
        tmpPaths.push(tmpDir);
        const personalRoot = path.join(tmpDir, "personal");
        const historyRoot = path.join(tmpDir, "skill-history");
        const skillDir = path.join(personalRoot, "my-skill");
        await fs.mkdir(skillDir, { recursive: true });
        await fs.writeFile(path.join(skillDir, "SKILL.md"), "---\nname: my-skill\n---\nCurrent");
        await fs.mkdir(path.join(historyRoot, "my-skill", "versions", "1"), { recursive: true });
        await fs.mkdir(path.join(historyRoot, "my-skill", "versions", "2"), { recursive: true });
        await fs.writeFile(
            path.join(historyRoot, "my-skill", "current.json"),
            `${JSON.stringify({ currentVersion: 3 })}\n`
        );

        const result = await skillsVersionsList({
            skillId: "user:my-skill",
            personalRoot,
            historyRoot,
            skills: {
                list: async () => [
                    {
                        id: "user:my-skill",
                        name: "my-skill",
                        source: "user",
                        sourcePath: path.join(skillDir, "SKILL.md")
                    }
                ]
            }
        });

        expect(result.ok).toBe(true);
        if (!result.ok) {
            throw new Error("Expected success.");
        }
        expect(result.skillId).toBe("user:my-skill");
        expect(result.skillName).toBe("my-skill");
        expect(result.currentVersion).toBe(3);
        expect(result.previousVersions.map((entry) => entry.version)).toEqual([1, 2]);
    });

    it("rejects non-user skills", async () => {
        const result = await skillsVersionsList({
            skillId: "core:test",
            personalRoot: "/tmp/unused",
            historyRoot: "/tmp/unused",
            skills: {
                list: async () => [
                    {
                        id: "core:test",
                        name: "test",
                        source: "core",
                        sourcePath: "/tmp/unused/SKILL.md"
                    }
                ]
            }
        });

        expect(result).toEqual({
            ok: false,
            error: "Only user skills have version history."
        });
    });
});
