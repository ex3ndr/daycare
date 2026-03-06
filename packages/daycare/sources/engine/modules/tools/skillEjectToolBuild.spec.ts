import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { Sandbox } from "../../../sandbox/sandbox.js";
import { skillEjectToolBuild } from "./skillEjectToolBuild.js";

const toolCall = { id: "tool-1", name: "skill_eject" };

describe("skillEjectToolBuild", () => {
    it("copies a personal skill folder to a destination path", async () => {
        const dirs = await testDirsCreate();
        try {
            const sourceDir = path.join(dirs.personalRoot, "my-skill-folder");
            await fs.mkdir(sourceDir, { recursive: true });
            await fs.writeFile(path.join(sourceDir, "SKILL.md"), "---\nname: my-skill\n---\nSkill content");
            await fs.writeFile(path.join(sourceDir, "notes.txt"), "helper");

            const tool = skillEjectToolBuild();
            const context = contextBuild({ homeDir: dirs.homeDir, skillsPersonalRoot: dirs.personalRoot });
            const result = await tool.execute({ name: "my-skill", path: "exports" }, context, toolCall);

            expect(result.typedResult.status).toBe("ejected");
            expect(result.typedResult.skillName).toBe("my-skill");
            const copiedSkill = await fs.readFile(
                path.join(dirs.homeDir, "exports", "my-skill-folder", "SKILL.md"),
                "utf8"
            );
            const copiedHelper = await fs.readFile(
                path.join(dirs.homeDir, "exports", "my-skill-folder", "notes.txt"),
                "utf8"
            );
            expect(copiedSkill).toContain("name: my-skill");
            expect(copiedHelper).toBe("helper");
        } finally {
            await dirs.cleanup();
        }
    });

    it("throws when the requested personal skill does not exist", async () => {
        const dirs = await testDirsCreate();
        try {
            await fs.mkdir(dirs.personalRoot, { recursive: true });
            const tool = skillEjectToolBuild();
            const context = contextBuild({ homeDir: dirs.homeDir, skillsPersonalRoot: dirs.personalRoot });
            await expect(tool.execute({ name: "missing", path: "exports" }, context, toolCall)).rejects.toThrow(
                'Personal skill not found: "missing"'
            );
        } finally {
            await dirs.cleanup();
        }
    });

    it("throws when personal skills root is not configured", async () => {
        const dirs = await testDirsCreate();
        try {
            const tool = skillEjectToolBuild();
            const context = contextBuild({ homeDir: dirs.homeDir });
            await expect(tool.execute({ name: "my-skill", path: "exports" }, context, toolCall)).rejects.toThrow(
                "Personal skills directory is not configured"
            );
        } finally {
            await dirs.cleanup();
        }
    });
});

async function testDirsCreate(): Promise<{
    baseDir: string;
    homeDir: string;
    personalRoot: string;
    cleanup: () => Promise<void>;
}> {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-eject-"));
    const homeDir = path.join(baseDir, "home");
    const personalRoot = path.join(baseDir, "personal");
    await fs.mkdir(homeDir, { recursive: true });
    return {
        baseDir,
        homeDir,
        personalRoot,
        cleanup: () => fs.rm(baseDir, { recursive: true, force: true })
    };
}

function contextBuild(input: { skillsPersonalRoot?: string; homeDir: string }): ToolExecutionContext {
    const sandbox = new Sandbox({
        homeDir: input.homeDir,
        permissions: { workingDir: input.homeDir, writeDirs: [input.homeDir] },
        docker: {
            readOnly: false,
            unconfinedSecurity: false,
            capAdd: [],
            capDrop: [],
            userId: "user-1"
        }
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
        skillsPersonalRoot: input.skillsPersonalRoot,
        agentSystem: {} as unknown as ToolExecutionContext["agentSystem"]
    };
}
