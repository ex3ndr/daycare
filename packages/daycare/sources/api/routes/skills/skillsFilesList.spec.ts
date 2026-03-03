import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { skillsFilesList } from "./skillsFilesList.js";

const tmpPaths: string[] = [];

afterEach(async () => {
    for (const tmpPath of tmpPaths.splice(0, tmpPaths.length)) {
        await fs.rm(tmpPath, { recursive: true, force: true });
    }
});

describe("skillsFilesList", () => {
    it("returns all skill files with metadata and download paths", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-files-"));
        tmpPaths.push(tmpDir);
        await fs.writeFile(path.join(tmpDir, "SKILL.md"), "# Example skill");
        await fs.mkdir(path.join(tmpDir, "scripts"), { recursive: true });
        await fs.writeFile(path.join(tmpDir, "scripts", "run.ts"), "export const run = true;\n");

        const files = await skillsFilesList({
            skillId: "user:example",
            sourcePath: path.join(tmpDir, "SKILL.md")
        });

        expect(files).toHaveLength(2);
        expect(files.map((file) => file.path)).toEqual(expect.arrayContaining(["SKILL.md", "scripts/run.ts"]));
        expect(files).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    path: "scripts/run.ts",
                    size: expect.any(Number),
                    updatedAt: expect.any(Number),
                    download: {
                        method: "GET",
                        path: "/skills/user%3Aexample/download?path=scripts%2Frun.ts"
                    }
                }),
                expect.objectContaining({
                    path: "SKILL.md",
                    size: expect.any(Number),
                    updatedAt: expect.any(Number),
                    download: {
                        method: "GET",
                        path: "/skills/user%3Aexample/download?path=SKILL.md"
                    }
                })
            ])
        );
    });

    it("returns empty list when skill root is missing", async () => {
        const files = await skillsFilesList({
            skillId: "user:missing",
            sourcePath: "/tmp/no-skill/SKILL.md"
        });

        expect(files).toEqual([]);
    });
});
