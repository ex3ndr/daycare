import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { skillRemoveToolBuild } from "./skillRemoveToolBuild.js";

const toolCall = { id: "tool-1", name: "skill_remove" };

describe("skillRemoveToolBuild", () => {
    it("removes a personal skill by name", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-rm-"));
        try {
            const personalRoot = path.join(tmpDir, "personal");
            const skillDir = path.join(personalRoot, "my-skill");
            await fs.mkdir(skillDir, { recursive: true });
            await fs.writeFile(path.join(skillDir, "skill.md"), "---\nname: my-skill\n---\nBody");
            await fs.writeFile(path.join(skillDir, "helper.txt"), "extra");

            const tool = skillRemoveToolBuild();
            const context = contextBuild({ skillsPersonalRoot: personalRoot });
            const result = await tool.execute({ name: "my-skill" }, context, toolCall);

            expect(result.typedResult.status).toBe("removed");
            expect(result.typedResult.skillName).toBe("my-skill");

            // Folder should be gone
            const exists = await fs
                .stat(skillDir)
                .then(() => true)
                .catch(() => false);
            expect(exists).toBe(false);
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    });

    it("matches skill name case-insensitively", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-rm-"));
        try {
            const personalRoot = path.join(tmpDir, "personal");
            const skillDir = path.join(personalRoot, "My-Skill");
            await fs.mkdir(skillDir, { recursive: true });
            await fs.writeFile(path.join(skillDir, "skill.md"), "---\nname: My-Skill\n---\nBody");

            const tool = skillRemoveToolBuild();
            const context = contextBuild({ skillsPersonalRoot: personalRoot });
            const result = await tool.execute({ name: "my-skill" }, context, toolCall);

            expect(result.typedResult.status).toBe("removed");
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    });

    it("throws when skill is not found", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-rm-"));
        try {
            const personalRoot = path.join(tmpDir, "personal");
            await fs.mkdir(personalRoot, { recursive: true });

            const tool = skillRemoveToolBuild();
            const context = contextBuild({ skillsPersonalRoot: personalRoot });
            await expect(tool.execute({ name: "nonexistent" }, context, toolCall)).rejects.toThrow(
                'Personal skill not found: "nonexistent"'
            );
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    });

    it("throws when personal root does not exist", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-rm-"));
        try {
            const tool = skillRemoveToolBuild();
            const context = contextBuild({ skillsPersonalRoot: path.join(tmpDir, "missing") });
            await expect(tool.execute({ name: "any" }, context, toolCall)).rejects.toThrow(
                'Personal skill not found: "any"'
            );
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    });

    it("throws when personal skills root is not configured", async () => {
        const tool = skillRemoveToolBuild();
        const context = contextBuild({});
        await expect(tool.execute({ name: "any" }, context, toolCall)).rejects.toThrow(
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
