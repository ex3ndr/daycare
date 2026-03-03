import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { skillsFileDownload } from "./skillsFileDownload.js";

const tmpPaths: string[] = [];

afterEach(async () => {
    for (const tmpPath of tmpPaths.splice(0, tmpPaths.length)) {
        await fs.rm(tmpPath, { recursive: true, force: true });
    }
});

describe("skillsFileDownload", () => {
    it("returns a skill file as downloadable content", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-download-"));
        tmpPaths.push(tmpDir);
        const skillPath = path.join(tmpDir, "SKILL.md");
        await fs.writeFile(skillPath, "# Skill\n");
        const scriptPath = path.join(tmpDir, "scripts", "run.ts");
        await fs.mkdir(path.dirname(scriptPath), { recursive: true });
        await fs.writeFile(scriptPath, "console.log('run');\n");

        const result = await skillsFileDownload({
            skillId: "user:example",
            filePath: "scripts/run.ts",
            skills: {
                list: async () => [
                    {
                        id: "user:example",
                        name: "Example",
                        source: "user",
                        sourcePath: skillPath
                    }
                ]
            }
        });

        expect(result.ok).toBe(true);
        if (!result.ok) {
            throw new Error("Expected successful file download.");
        }

        expect(result.file.path).toBe("scripts/run.ts");
        expect(result.file.mimeType).toBe("text/plain; charset=utf-8");
        expect(result.content.toString("utf8")).toBe("console.log('run');\n");
    });

    it("rejects path traversal outside skill root", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-download-traversal-"));
        tmpPaths.push(tmpDir);
        const skillPath = path.join(tmpDir, "SKILL.md");
        await fs.writeFile(skillPath, "# Skill\n");

        const result = await skillsFileDownload({
            skillId: "user:example",
            filePath: "../outside.txt",
            skills: {
                list: async () => [
                    {
                        id: "user:example",
                        name: "Example",
                        source: "user",
                        sourcePath: skillPath
                    }
                ]
            }
        });

        expect(result).toEqual({
            ok: false,
            statusCode: 400,
            error: "Invalid file path."
        });
    });

    it("returns not found when file is missing", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-download-missing-"));
        tmpPaths.push(tmpDir);
        const skillPath = path.join(tmpDir, "SKILL.md");
        await fs.writeFile(skillPath, "# Skill\n");

        const result = await skillsFileDownload({
            skillId: "user:example",
            filePath: "missing.md",
            skills: {
                list: async () => [
                    {
                        id: "user:example",
                        name: "Example",
                        source: "user",
                        sourcePath: skillPath
                    }
                ]
            }
        });

        expect(result).toEqual({
            ok: false,
            statusCode: 404,
            error: "File not found."
        });
    });
});
