import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { Sandbox } from "../../../sandbox/sandbox.js";
import { skillAddToolBuild } from "./skillAddToolBuild.js";

const toolCall = { id: "tool-1", name: "skill_add" };

describe("skillAddToolBuild", () => {
    it("installs a skill to the personal directory", async () => {
        const dirs = await testDirsCreate();
        try {
            const sourceDir = path.join(dirs.homeDir, "source-skill");
            await fs.mkdir(sourceDir, { recursive: true });
            await fs.writeFile(
                path.join(sourceDir, "skill.md"),
                "---\nname: test-skill\ndescription: A test skill\n---\nBody content"
            );
            await fs.writeFile(path.join(sourceDir, "helper.txt"), "extra file");

            const tool = skillAddToolBuild();
            const context = contextBuild({
                skillsPersonalRoot: dirs.personalRoot,
                homeDir: dirs.homeDir
            });
            const result = await tool.execute({ path: "source-skill" }, context, toolCall);

            expect(result.typedResult.status).toBe("installed");
            expect(result.typedResult.skillName).toBe("test-skill");

            // Verify files were copied
            const targetSkill = await fs.readFile(path.join(dirs.personalRoot, "test-skill", "skill.md"), "utf8");
            expect(targetSkill).toContain("name: test-skill");
            const targetHelper = await fs.readFile(path.join(dirs.personalRoot, "test-skill", "helper.txt"), "utf8");
            expect(targetHelper).toBe("extra file");
        } finally {
            await dirs.cleanup();
        }
    });

    it("installs a skill from ~/ path when source uses SKILL.md", async () => {
        const dirs = await testDirsCreate();
        try {
            const sourceDir = path.join(dirs.homeDir, "skills", "source-skill");
            await fs.mkdir(sourceDir, { recursive: true });
            await fs.writeFile(
                path.join(sourceDir, "SKILL.md"),
                "---\nname: upper-skill\ndescription: Uses uppercase filename\n---\nBody content"
            );

            const tool = skillAddToolBuild();
            const context = contextBuild({
                skillsPersonalRoot: dirs.personalRoot,
                homeDir: dirs.homeDir
            });
            const result = await tool.execute({ path: "~/skills/source-skill" }, context, toolCall);

            expect(result.typedResult.status).toBe("installed");
            expect(result.typedResult.skillName).toBe("upper-skill");
            const targetSkill = await fs.readFile(path.join(dirs.personalRoot, "upper-skill", "SKILL.md"), "utf8");
            expect(targetSkill).toContain("name: upper-skill");
        } finally {
            await dirs.cleanup();
        }
    });

    it("installs a skill when source uses mixed-case sKiLl.Md", async () => {
        const dirs = await testDirsCreate();
        try {
            const sourceDir = path.join(dirs.homeDir, "skills", "mixed-case-skill");
            await fs.mkdir(sourceDir, { recursive: true });
            await fs.writeFile(
                path.join(sourceDir, "sKiLl.Md"),
                "---\nname: mixed-case\ndescription: mixed\n---\nBody"
            );

            const tool = skillAddToolBuild();
            const context = contextBuild({
                skillsPersonalRoot: dirs.personalRoot,
                homeDir: dirs.homeDir
            });
            const result = await tool.execute({ path: "~/skills/mixed-case-skill" }, context, toolCall);

            expect(result.typedResult.status).toBe("installed");
            expect(result.typedResult.skillName).toBe("mixed-case");
            const targetSkill = await fs.readFile(path.join(dirs.personalRoot, "mixed-case", "sKiLl.Md"), "utf8");
            expect(targetSkill).toContain("name: mixed-case");
        } finally {
            await dirs.cleanup();
        }
    });

    it("installs a skill from a direct skill file path", async () => {
        const dirs = await testDirsCreate();
        try {
            const sourceDir = path.join(dirs.homeDir, "skills", "file-source");
            await fs.mkdir(sourceDir, { recursive: true });
            await fs.writeFile(path.join(sourceDir, "skill.md"), "---\nname: direct-skill\n---\nBody content");

            const tool = skillAddToolBuild();
            const context = contextBuild({
                skillsPersonalRoot: dirs.personalRoot,
                homeDir: dirs.homeDir
            });
            const result = await tool.execute({ path: "~/skills/file-source/skill.md" }, context, toolCall);

            expect(result.typedResult.status).toBe("installed");
            expect(result.typedResult.skillName).toBe("direct-skill");
            const targetSkill = await fs.readFile(path.join(dirs.personalRoot, "direct-skill", "skill.md"), "utf8");
            expect(targetSkill).toContain("name: direct-skill");
        } finally {
            await dirs.cleanup();
        }
    });

    it("replaces an existing skill with the same name", async () => {
        const dirs = await testDirsCreate();
        try {
            const sourceDir = path.join(dirs.homeDir, "source-skill");
            await fs.mkdir(sourceDir, { recursive: true });
            await fs.writeFile(path.join(sourceDir, "skill.md"), "---\nname: test-skill\n---\nUpdated body");

            // Pre-create existing skill
            const existingDir = path.join(dirs.personalRoot, "test-skill");
            await fs.mkdir(existingDir, { recursive: true });
            await fs.writeFile(path.join(existingDir, "skill.md"), "---\nname: test-skill\n---\nOld body");

            const tool = skillAddToolBuild();
            const context = contextBuild({
                skillsPersonalRoot: dirs.personalRoot,
                homeDir: dirs.homeDir
            });
            const result = await tool.execute({ path: "source-skill" }, context, toolCall);

            expect(result.typedResult.status).toBe("replaced");
            expect(result.typedResult.skillName).toBe("test-skill");

            const content = await fs.readFile(path.join(dirs.personalRoot, "test-skill", "skill.md"), "utf8");
            expect(content).toContain("Updated body");
        } finally {
            await dirs.cleanup();
        }
    });

    it("throws when source path is not a directory", async () => {
        const dirs = await testDirsCreate();
        try {
            const tool = skillAddToolBuild();
            const context = contextBuild({
                skillsPersonalRoot: dirs.personalRoot,
                homeDir: dirs.homeDir
            });
            await expect(tool.execute({ path: "nonexistent" }, context, toolCall)).rejects.toThrow(
                'Expected a readable file named "skill.md" (case-insensitive)'
            );
            await expect(tool.execute({ path: "nonexistent" }, context, toolCall)).rejects.toThrow("none were found");
            await expect(tool.execute({ path: "nonexistent" }, context, toolCall)).rejects.toThrow(
                "Tried 128 filename case variants"
            );
        } finally {
            await dirs.cleanup();
        }
    });

    it("throws when skill.md is missing", async () => {
        const dirs = await testDirsCreate();
        try {
            const sourceDir = path.join(dirs.homeDir, "empty-skill");
            await fs.mkdir(sourceDir, { recursive: true });

            const tool = skillAddToolBuild();
            const context = contextBuild({
                skillsPersonalRoot: dirs.personalRoot,
                homeDir: dirs.homeDir
            });
            await expect(tool.execute({ path: "empty-skill" }, context, toolCall)).rejects.toThrow(
                "not a valid skill directory"
            );
        } finally {
            await dirs.cleanup();
        }
    });

    it("throws when skill.md has no name in frontmatter", async () => {
        const dirs = await testDirsCreate();
        try {
            const sourceDir = path.join(dirs.homeDir, "bad-skill");
            await fs.mkdir(sourceDir, { recursive: true });
            await fs.writeFile(path.join(sourceDir, "skill.md"), "---\ndescription: no name\n---\nBody");

            const tool = skillAddToolBuild();
            const context = contextBuild({
                skillsPersonalRoot: dirs.personalRoot,
                homeDir: dirs.homeDir
            });
            await expect(tool.execute({ path: "bad-skill" }, context, toolCall)).rejects.toThrow(
                'No valid skill.md with "name" frontmatter'
            );
        } finally {
            await dirs.cleanup();
        }
    });

    it("throws when skill name contains path traversal characters", async () => {
        const dirs = await testDirsCreate();
        try {
            const sourceDir = path.join(dirs.homeDir, "evil-skill");
            await fs.mkdir(sourceDir, { recursive: true });
            await fs.writeFile(path.join(sourceDir, "skill.md"), "---\nname: ../../../etc\n---\nBody");

            const tool = skillAddToolBuild();
            const context = contextBuild({
                skillsPersonalRoot: dirs.personalRoot,
                homeDir: dirs.homeDir
            });
            await expect(tool.execute({ path: "evil-skill" }, context, toolCall)).rejects.toThrow("invalid characters");
        } finally {
            await dirs.cleanup();
        }
    });

    it("throws when personal skills root is not configured", async () => {
        const dirs = await testDirsCreate();
        try {
            const tool = skillAddToolBuild();
            const context = contextBuild({ homeDir: dirs.homeDir });
            await expect(tool.execute({ path: "/some/path" }, context, toolCall)).rejects.toThrow(
                "Personal skills directory is not configured"
            );
        } finally {
            await dirs.cleanup();
        }
    });

    it("throws when source path is blank", async () => {
        const dirs = await testDirsCreate();
        try {
            const tool = skillAddToolBuild();
            const context = contextBuild({
                skillsPersonalRoot: dirs.personalRoot,
                homeDir: dirs.homeDir
            });
            await expect(tool.execute({ path: "   " }, context, toolCall)).rejects.toThrow("Source path is required.");
        } finally {
            await dirs.cleanup();
        }
    });
});

async function testDirsCreate(): Promise<{
    homeDir: string;
    personalRoot: string;
    cleanup: () => Promise<void>;
}> {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-add-"));
    const homeDir = path.join(baseDir, "home");
    const personalRoot = path.join(baseDir, "personal");
    await fs.mkdir(homeDir, { recursive: true });
    return {
        homeDir,
        personalRoot,
        cleanup: () => fs.rm(baseDir, { recursive: true, force: true })
    };
}

function contextBuild(input: { skillsPersonalRoot?: string; homeDir: string }): ToolExecutionContext {
    const sandbox = new Sandbox({
        homeDir: input.homeDir,
        permissions: { workingDir: input.homeDir, writeDirs: [input.homeDir] }
    });
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox,
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: { id: "agent-1", descriptor: { type: "user" } } as unknown as ToolExecutionContext["agent"],
        ctx: { userId: "user-1", agentId: "agent-1" } as unknown as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        skills: [],
        skillsPersonalRoot: input?.skillsPersonalRoot,
        agentSystem: {} as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}
