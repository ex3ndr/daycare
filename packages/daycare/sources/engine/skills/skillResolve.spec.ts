import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { skillResolve } from "./skillResolve.js";

describe("skillResolve", () => {
    it("parses sandbox true and permissions from frontmatter", async () => {
        const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-skill-resolve-"));
        try {
            const skillDir = path.join(baseDir, "deploy");
            await fs.mkdir(skillDir, { recursive: true });
            const skillPath = path.join(skillDir, "SKILL.md");
            await fs.writeFile(
                skillPath,
                [
                    "---",
                    "name: deploy",
                    "description: Deploy project",
                    "sandbox: true",
                    "permissions:",
                    '  - "@read:/workspace"',
                    '  - "@network"',
                    "---",
                    "",
                    "# Deploy"
                ].join("\n")
            );

            const skill = await skillResolve(skillPath, { source: "config", root: baseDir }, baseDir);
            expect(skill?.sandbox).toBe(true);
            expect(skill?.permissions).toEqual(["@read:/workspace", "@network"]);
            expect(skill?.sourcePath).toBe(path.resolve(skillPath));
        } finally {
            await fs.rm(baseDir, { recursive: true, force: true });
        }
    });

    it("parses sandbox false from frontmatter", async () => {
        const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-skill-resolve-"));
        try {
            const skillDir = path.join(baseDir, "plan");
            await fs.mkdir(skillDir, { recursive: true });
            const skillPath = path.join(skillDir, "SKILL.md");
            await fs.writeFile(skillPath, "---\nname: plan\ndescription: Plan work\nsandbox: false\n---\n\n# Plan");

            const skill = await skillResolve(skillPath, { source: "config", root: baseDir }, baseDir);
            expect(skill?.sandbox).toBe(false);
        } finally {
            await fs.rm(baseDir, { recursive: true, force: true });
        }
    });

    it("leaves sandbox undefined when frontmatter omits it", async () => {
        const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-skill-resolve-"));
        try {
            const skillDir = path.join(baseDir, "review");
            await fs.mkdir(skillDir, { recursive: true });
            const skillPath = path.join(skillDir, "SKILL.md");
            await fs.writeFile(skillPath, "---\nname: review\ndescription: Review code\n---\n\n# Review");

            const skill = await skillResolve(skillPath, { source: "config", root: baseDir }, baseDir);
            expect(skill?.sandbox).toBeUndefined();
            expect(skill?.permissions).toBeUndefined();
        } finally {
            await fs.rm(baseDir, { recursive: true, force: true });
        }
    });

    it("builds agents source ids for ~/.agents/skills entries", async () => {
        const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-skill-resolve-"));
        try {
            const skillDir = path.join(baseDir, "agents-helper");
            await fs.mkdir(skillDir, { recursive: true });
            const skillPath = path.join(skillDir, "SKILL.md");
            await fs.writeFile(skillPath, "---\nname: agents-helper\n---\n\n# Helper");

            const skill = await skillResolve(skillPath, { source: "agents", root: baseDir }, baseDir);
            expect(skill?.id).toBe("agents:agents-helper");
            expect(skill?.source).toBe("agents");
        } finally {
            await fs.rm(baseDir, { recursive: true, force: true });
        }
    });
});
