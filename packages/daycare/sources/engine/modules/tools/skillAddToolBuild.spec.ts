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
                path.join(sourceDir, "SKILL.md"),
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
            const targetSkill = await fs.readFile(path.join(dirs.personalRoot, "test-skill", "SKILL.md"), "utf8");
            expect(targetSkill).toContain("name: test-skill");
            const targetHelper = await fs.readFile(path.join(dirs.personalRoot, "test-skill", "helper.txt"), "utf8");
            expect(targetHelper).toBe("extra file");
        } finally {
            await dirs.cleanup();
        }
    });

    it("replaces an existing skill with the same name", async () => {
        const dirs = await testDirsCreate();
        try {
            const sourceDir = path.join(dirs.homeDir, "source-skill");
            await fs.mkdir(sourceDir, { recursive: true });
            await fs.writeFile(path.join(sourceDir, "SKILL.md"), "---\nname: test-skill\n---\nUpdated body");

            // Pre-create existing skill
            const existingDir = path.join(dirs.personalRoot, "test-skill");
            await fs.mkdir(existingDir, { recursive: true });
            await fs.writeFile(path.join(existingDir, "SKILL.md"), "---\nname: test-skill\n---\nOld body");

            const tool = skillAddToolBuild();
            const context = contextBuild({
                skillsPersonalRoot: dirs.personalRoot,
                homeDir: dirs.homeDir
            });
            const result = await tool.execute({ path: "source-skill" }, context, toolCall);

            expect(result.typedResult.status).toBe("replaced");
            expect(result.typedResult.skillName).toBe("test-skill");

            const content = await fs.readFile(path.join(dirs.personalRoot, "test-skill", "SKILL.md"), "utf8");
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
                "not a valid skill directory"
            );
        } finally {
            await dirs.cleanup();
        }
    });

    it("throws when SKILL.md is missing", async () => {
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

    it("throws when SKILL.md has no name in frontmatter", async () => {
        const dirs = await testDirsCreate();
        try {
            const sourceDir = path.join(dirs.homeDir, "bad-skill");
            await fs.mkdir(sourceDir, { recursive: true });
            await fs.writeFile(path.join(sourceDir, "SKILL.md"), "---\ndescription: no name\n---\nBody");

            const tool = skillAddToolBuild();
            const context = contextBuild({
                skillsPersonalRoot: dirs.personalRoot,
                homeDir: dirs.homeDir
            });
            await expect(tool.execute({ path: "bad-skill" }, context, toolCall)).rejects.toThrow(
                'No valid SKILL.md with "name" frontmatter'
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
            await fs.writeFile(path.join(sourceDir, "SKILL.md"), "---\nname: ../../../etc\n---\nBody");

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

    it("installs a skill to a target workspace user when userId is provided", async () => {
        const dirs = await testDirsCreate();
        try {
            const sourceDir = path.join(dirs.homeDir, "source-skill");
            await fs.mkdir(sourceDir, { recursive: true });
            await fs.writeFile(path.join(sourceDir, "SKILL.md"), "---\nname: test-skill\n---\nBody");

            const workspaceUserId = "workspace-1";
            const workspacePersonalRoot = path.join(dirs.baseDir, workspaceUserId, "skills", "personal");
            const tool = skillAddToolBuild();
            const context = contextBuild({
                skillsPersonalRoot: dirs.personalRoot,
                homeDir: dirs.homeDir,
                agentSystem: {
                    storage: {
                        users: {
                            findById: async (id: string) => {
                                if (id === "owner-1") {
                                    return {
                                        id: "owner-1",
                                        isWorkspace: false,
                                        parentUserId: null
                                    };
                                }
                                if (id === workspaceUserId) {
                                    return {
                                        id: workspaceUserId,
                                        isWorkspace: true,
                                        parentUserId: "owner-1"
                                    };
                                }
                                return null;
                            }
                        }
                    },
                    userHomeForUserId: (userId: string) => ({
                        skillsPersonal: path.join(dirs.baseDir, userId, "skills", "personal")
                    })
                } as unknown as ToolExecutionContext["agentSystem"],
                ctx: { userId: "owner-1", agentId: "agent-1" } as ToolExecutionContext["ctx"]
            });
            const result = await tool.execute({ path: "source-skill", userId: workspaceUserId }, context, toolCall);

            expect(result.typedResult.status).toBe("installed");
            const installed = await fs.readFile(path.join(workspacePersonalRoot, "test-skill", "SKILL.md"), "utf8");
            expect(installed).toContain("name: test-skill");
        } finally {
            await dirs.cleanup();
        }
    });

    it("throws when non-owner user tries to install a skill to a workspace", async () => {
        const dirs = await testDirsCreate();
        try {
            const sourceDir = path.join(dirs.homeDir, "source-skill");
            await fs.mkdir(sourceDir, { recursive: true });
            await fs.writeFile(path.join(sourceDir, "SKILL.md"), "---\nname: test-skill\n---\nBody");

            const tool = skillAddToolBuild();
            const context = contextBuild({
                skillsPersonalRoot: dirs.personalRoot,
                homeDir: dirs.homeDir,
                agentSystem: {
                    storage: {
                        users: {
                            findById: async (id: string) => {
                                if (id === "user-1") {
                                    return {
                                        id: "user-1",
                                        isWorkspace: false,
                                        parentUserId: null
                                    };
                                }
                                if (id === "workspace-1") {
                                    return {
                                        id: "workspace-1",
                                        isWorkspace: true,
                                        parentUserId: "owner-1"
                                    };
                                }
                                return null;
                            }
                        }
                    }
                } as unknown as ToolExecutionContext["agentSystem"]
            });

            await expect(
                tool.execute({ path: "source-skill", userId: "workspace-1" }, context, toolCall)
            ).rejects.toThrow("Only workspace owners can install skills to workspaces.");
        } finally {
            await dirs.cleanup();
        }
    });

    it("throws when target workspace is not found", async () => {
        const dirs = await testDirsCreate();
        try {
            const sourceDir = path.join(dirs.homeDir, "source-skill");
            await fs.mkdir(sourceDir, { recursive: true });
            await fs.writeFile(path.join(sourceDir, "SKILL.md"), "---\nname: test-skill\n---\nBody");

            const tool = skillAddToolBuild();
            const context = contextBuild({
                skillsPersonalRoot: dirs.personalRoot,
                homeDir: dirs.homeDir,
                agentSystem: {
                    storage: {
                        users: {
                            findById: async (id: string) =>
                                id === "owner-1"
                                    ? {
                                          id: "owner-1",
                                          isWorkspace: false,
                                          parentUserId: null
                                      }
                                    : null
                        }
                    },
                    userHomeForUserId: (userId: string) => ({
                        skillsPersonal: path.join(dirs.baseDir, userId, "skills", "personal")
                    })
                } as unknown as ToolExecutionContext["agentSystem"],
                ctx: { userId: "owner-1", agentId: "agent-1" } as ToolExecutionContext["ctx"]
            });

            await expect(
                tool.execute({ path: "source-skill", userId: "missing-workspace" }, context, toolCall)
            ).rejects.toThrow("Workspace not found: missing-workspace");
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
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-add-"));
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

function contextBuild(input: {
    skillsPersonalRoot?: string;
    homeDir: string;
    agentSystem?: ToolExecutionContext["agentSystem"];
    ctx?: ToolExecutionContext["ctx"];
}): ToolExecutionContext {
    const sandbox = new Sandbox({
        homeDir: input.homeDir,
        permissions: { workingDir: input.homeDir, writeDirs: [input.homeDir] },
        backend: {
            type: "docker",
            docker: {
                readOnly: false,
                unconfinedSecurity: false,
                capAdd: [],
                capDrop: [],
                userId: "user-1"
            }
        }
    });
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox,
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: { id: "agent-1", descriptor: { type: "user" } } as unknown as ToolExecutionContext["agent"],
        ctx: input.ctx ?? ({ userId: "user-1", agentId: "agent-1" } as unknown as ToolExecutionContext["ctx"]),
        source: "test",
        messageContext: {},
        skills: [],
        skillsPersonalRoot: input?.skillsPersonalRoot,
        agentSystem: input.agentSystem ?? ({} as unknown as ToolExecutionContext["agentSystem"])
    };
}
