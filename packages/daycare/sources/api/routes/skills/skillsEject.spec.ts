import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { skillsEject } from "./skillsEject.js";

const tmpPaths: string[] = [];

afterEach(async () => {
    for (const tmpPath of tmpPaths.splice(0, tmpPaths.length)) {
        await fs.rm(tmpPath, { recursive: true, force: true });
    }
});

describe("skillsEject", () => {
    it("copies a personal skill folder to destination path", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-eject-"));
        tmpPaths.push(tmpDir);
        const personalRoot = path.join(tmpDir, "personal");
        const historyRoot = path.join(tmpDir, "skills-history");
        const destination = path.join(tmpDir, "exports");
        const sourceDir = path.join(personalRoot, "my-skill-folder");
        await fs.mkdir(sourceDir, { recursive: true });
        await fs.writeFile(path.join(sourceDir, "SKILL.md"), "---\nname: my-skill\n---\nSkill body");
        await fs.writeFile(path.join(sourceDir, "helper.txt"), "helper");

        const result = await skillsEject({
            personalRoot,
            historyRoot,
            skillName: "my-skill",
            destinationPath: destination
        });

        expect(result).toEqual({
            ok: true,
            skillName: "my-skill",
            status: "ejected",
            version: 1
        });
        const copied = await fs.readFile(path.join(destination, "my-skill", "SKILL.md"), "utf8");
        expect(copied).toContain("name: my-skill");
    });

    it("copies a historical skill version when version is provided", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-eject-version-"));
        tmpPaths.push(tmpDir);
        const personalRoot = path.join(tmpDir, "personal");
        const historyRoot = path.join(tmpDir, "skills-history");
        const destination = path.join(tmpDir, "exports");
        await fs.mkdir(path.join(personalRoot, "my-skill-folder"), { recursive: true });
        await fs.writeFile(path.join(personalRoot, "my-skill-folder", "SKILL.md"), "---\nname: my-skill\n---\nCurrent");
        await fs.mkdir(path.join(historyRoot, "my-skill", "versions", "1"), { recursive: true });
        await fs.writeFile(
            path.join(historyRoot, "my-skill", "versions", "1", "SKILL.md"),
            "---\nname: my-skill\n---\nArchived"
        );
        await fs.writeFile(
            path.join(historyRoot, "my-skill", "current.json"),
            `${JSON.stringify({ currentVersion: 2 })}\n`
        );

        const result = await skillsEject({
            personalRoot,
            historyRoot,
            skillName: "my-skill",
            destinationPath: destination,
            version: 1
        });

        expect(result).toEqual({
            ok: true,
            skillName: "my-skill",
            status: "ejected",
            version: 1
        });
        const copied = await fs.readFile(path.join(destination, "my-skill", "SKILL.md"), "utf8");
        expect(copied).toContain("Archived");
    });

    it("returns not found when personal skill does not exist", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-eject-missing-"));
        tmpPaths.push(tmpDir);
        const result = await skillsEject({
            personalRoot: path.join(tmpDir, "personal"),
            historyRoot: path.join(tmpDir, "skills-history"),
            skillName: "missing",
            destinationPath: path.join(tmpDir, "exports")
        });

        expect(result).toEqual({
            ok: false,
            error: 'Personal skill not found: "missing".'
        });
    });
});
