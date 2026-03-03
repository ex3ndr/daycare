import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { skillsList } from "./skillsList.js";

const tmpPaths: string[] = [];

afterEach(async () => {
    for (const tmpPath of tmpPaths.splice(0, tmpPaths.length)) {
        await fs.rm(tmpPath, { recursive: true, force: true });
    }
});

describe("skillsList", () => {
    it("returns listed skills with file metadata and without sourcePath", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-list-"));
        tmpPaths.push(tmpDir);
        const skillPath = path.join(tmpDir, "SKILL.md");
        await fs.writeFile(skillPath, "# My Skill\n");
        const extraPath = path.join(tmpDir, "notes.txt");
        await fs.writeFile(extraPath, "extra notes");

        const result = await skillsList({
            skills: {
                list: async () => [
                    {
                        id: "user:my-skill",
                        name: "My Skill",
                        description: "desc",
                        sandbox: true,
                        permissions: ["@read:/tmp"],
                        source: "user",
                        sourcePath: skillPath
                    }
                ]
            }
        });

        expect(result.ok).toBe(true);
        expect(result.skills).toHaveLength(1);
        const skill = result.skills[0];
        expect(skill).toEqual(
            expect.objectContaining({
                id: "user:my-skill",
                name: "My Skill",
                description: "desc",
                sandbox: true,
                permissions: ["@read:/tmp"],
                source: "user"
            })
        );
        expect(skill).not.toHaveProperty("sourcePath");
        expect(skill?.files).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    path: "SKILL.md",
                    size: expect.any(Number),
                    updatedAt: expect.any(Number),
                    download: {
                        method: "GET",
                        path: "/skills/user%3Amy-skill/download?path=SKILL.md"
                    }
                }),
                expect.objectContaining({
                    path: "notes.txt",
                    size: expect.any(Number),
                    updatedAt: expect.any(Number),
                    download: {
                        method: "GET",
                        path: "/skills/user%3Amy-skill/download?path=notes.txt"
                    }
                })
            ])
        );
    });

    it("returns empty list", async () => {
        const result = await skillsList({
            skills: {
                list: async () => []
            }
        });

        expect(result).toEqual({ ok: true, skills: [] });
    });
});
