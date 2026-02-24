import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { skillAddToolBuild } from "./skillAddToolBuild.js";

const toolCall = { id: "tool-1", name: "skill_add" };

describe("skillAddToolBuild", () => {
    it("installs a skill to the personal directory", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-add-"));
        try {
            const sourceDir = path.join(tmpDir, "source-skill");
            const personalRoot = path.join(tmpDir, "personal");
            await fs.mkdir(sourceDir, { recursive: true });
            await fs.writeFile(
                path.join(sourceDir, "skill.md"),
                "---\nname: test-skill\ndescription: A test skill\n---\nBody content"
            );
            await fs.writeFile(path.join(sourceDir, "helper.txt"), "extra file");

            const tool = skillAddToolBuild();
            const context = contextBuild({ skillsPersonalRoot: personalRoot });
            const result = await tool.execute({ path: sourceDir }, context, toolCall);

            expect(result.typedResult.status).toBe("installed");
            expect(result.typedResult.skillName).toBe("test-skill");

            // Verify files were copied
            const targetSkill = await fs.readFile(path.join(personalRoot, "test-skill", "skill.md"), "utf8");
            expect(targetSkill).toContain("name: test-skill");
            const targetHelper = await fs.readFile(path.join(personalRoot, "test-skill", "helper.txt"), "utf8");
            expect(targetHelper).toBe("extra file");
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    });

    it("replaces an existing skill with the same name", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-add-"));
        try {
            const sourceDir = path.join(tmpDir, "source-skill");
            const personalRoot = path.join(tmpDir, "personal");
            await fs.mkdir(sourceDir, { recursive: true });
            await fs.writeFile(path.join(sourceDir, "skill.md"), "---\nname: test-skill\n---\nUpdated body");

            // Pre-create existing skill
            const existingDir = path.join(personalRoot, "test-skill");
            await fs.mkdir(existingDir, { recursive: true });
            await fs.writeFile(path.join(existingDir, "skill.md"), "---\nname: test-skill\n---\nOld body");

            const tool = skillAddToolBuild();
            const context = contextBuild({ skillsPersonalRoot: personalRoot });
            const result = await tool.execute({ path: sourceDir }, context, toolCall);

            expect(result.typedResult.status).toBe("replaced");
            expect(result.typedResult.skillName).toBe("test-skill");

            const content = await fs.readFile(path.join(personalRoot, "test-skill", "skill.md"), "utf8");
            expect(content).toContain("Updated body");
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    });

    it("throws when source path is not a directory", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-add-"));
        try {
            const tool = skillAddToolBuild();
            const context = contextBuild({ skillsPersonalRoot: path.join(tmpDir, "personal") });
            await expect(tool.execute({ path: path.join(tmpDir, "nonexistent") }, context, toolCall)).rejects.toThrow(
                "not a directory"
            );
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    });

    it("throws when skill.md is missing", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-add-"));
        try {
            const sourceDir = path.join(tmpDir, "empty-skill");
            await fs.mkdir(sourceDir, { recursive: true });

            const tool = skillAddToolBuild();
            const context = contextBuild({ skillsPersonalRoot: path.join(tmpDir, "personal") });
            await expect(tool.execute({ path: sourceDir }, context, toolCall)).rejects.toThrow(
                'No valid skill.md with "name" frontmatter'
            );
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    });

    it("throws when skill.md has no name in frontmatter", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-add-"));
        try {
            const sourceDir = path.join(tmpDir, "bad-skill");
            await fs.mkdir(sourceDir, { recursive: true });
            await fs.writeFile(path.join(sourceDir, "skill.md"), "---\ndescription: no name\n---\nBody");

            const tool = skillAddToolBuild();
            const context = contextBuild({ skillsPersonalRoot: path.join(tmpDir, "personal") });
            await expect(tool.execute({ path: sourceDir }, context, toolCall)).rejects.toThrow(
                'No valid skill.md with "name" frontmatter'
            );
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    });

    it("throws when skill name contains path traversal characters", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-add-"));
        try {
            const sourceDir = path.join(tmpDir, "evil-skill");
            await fs.mkdir(sourceDir, { recursive: true });
            await fs.writeFile(path.join(sourceDir, "skill.md"), "---\nname: ../../../etc\n---\nBody");

            const tool = skillAddToolBuild();
            const context = contextBuild({ skillsPersonalRoot: path.join(tmpDir, "personal") });
            await expect(tool.execute({ path: sourceDir }, context, toolCall)).rejects.toThrow("invalid characters");
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    });

    it("throws when personal skills root is not configured", async () => {
        const tool = skillAddToolBuild();
        const context = contextBuild({});
        await expect(tool.execute({ path: "/some/path" }, context, toolCall)).rejects.toThrow(
            "Personal skills directory is not configured"
        );
    });
});

function contextBuild(input?: { skillsPersonalRoot?: string }): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: {
            permissions: { workingDir: "/workspace", writeDirs: ["/workspace"] },
            workingDir: "/workspace"
        } as unknown as ToolExecutionContext["sandbox"],
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
