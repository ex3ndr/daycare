import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { AgentDescriptor, AgentSkill, SessionPermissions, ToolExecutionContext } from "@/types";
import { Sandbox } from "../../../sandbox/sandbox.js";
import { contextForAgent } from "../../agents/context.js";
import { skillActivationKeyBuild } from "../../skills/skillActivationKeyBuild.js";
import { skillToolBuild } from "./skillToolBuild.js";

const toolCall = { id: "tool-1", name: "skill" };

describe("skillToolBuild", () => {
    it("returns embedded skill instructions for non-sandbox skills", async () => {
        const dirs = await activeRootCreate();
        try {
            const skill = skillBuild({ name: "scheduling", id: "config:scheduling" });
            await activeSkillWrite(dirs.activeRoot, skill.id, "# scheduling\nUse this skill.");

            const tool = skillToolBuild();
            const context = contextBuild({ skills: [skill], activeRoot: dirs.activeRoot, homeDir: dirs.homeDir });

            const result = await tool.execute({ name: "scheduling" }, context, toolCall);
            expect(contentText(result.toolMessage.content)).toContain(
                "Skill loaded (embedded). Follow the instructions below:"
            );
            expect(contentText(result.toolMessage.content)).toContain("# scheduling");
        } finally {
            await dirs.cleanup();
        }
    });

    it("loads named skills from active root and prepends sandbox base directory", async () => {
        const dirs = await activeRootCreate();
        try {
            const skill = skillBuild({ name: "scheduling", id: "core:scheduling", source: "core" });
            await activeSkillWrite(dirs.activeRoot, skill.id, "# active\nUse active copy.");

            const activationKey = skillActivationKeyBuild(skill.id);
            const tool = skillToolBuild();
            const context = contextBuild({ skills: [skill], activeRoot: dirs.activeRoot, homeDir: dirs.homeDir });

            const result = await tool.execute({ name: "scheduling" }, context, toolCall);
            const text = contentText(result.toolMessage.content);
            expect(text).toContain(`Base directory for this skill: /shared/skills/${activationKey}`);
            expect(text).toContain("Skill name: scheduling");
            expect(text).toContain("# active");
        } finally {
            await dirs.cleanup();
        }
    });

    it("uses same sandbox base directory regardless of docker mode", async () => {
        const dirs = await activeRootCreate();
        try {
            const skill = skillBuild({ name: "deploy", id: "core:deploy", source: "core" });
            await activeSkillWrite(dirs.activeRoot, skill.id, "# active docker");

            const activationKey = skillActivationKeyBuild(skill.id);
            const tool = skillToolBuild();
            const context = contextBuild({
                skills: [skill],
                activeRoot: dirs.activeRoot,
                homeDir: dirs.homeDir,
                dockerEnabled: true
            });

            const result = await tool.execute({ name: "deploy" }, context, toolCall);
            expect(contentText(result.toolMessage.content)).toContain(
                `Base directory for this skill: /shared/skills/${activationKey}`
            );
        } finally {
            await dirs.cleanup();
        }
    });

    it("runs sandbox skills in a subagent and returns subagent output", async () => {
        const dirs = await activeRootCreate();
        try {
            const skill = skillBuild({ name: "deploy", id: "config:deploy", sandbox: true });
            await activeSkillWrite(dirs.activeRoot, skill.id, "# deploy\nDeploy instructions.");

            const agentIdForTarget = vi.fn(async () => "agent-sub");
            const postAndAwait = vi.fn(async () => ({
                type: "message" as const,
                responseText: "Deployment complete."
            }));
            const tool = skillToolBuild();
            const context = contextBuild({
                skills: [skill],
                activeRoot: dirs.activeRoot,
                homeDir: dirs.homeDir,
                agentSystem: { agentIdForTarget, postAndAwait }
            });

            const result = await tool.execute({ name: "deploy", prompt: "Deploy version 1.2.3" }, context, toolCall);

            expect(agentIdForTarget).toHaveBeenCalledTimes(1);
            expect(agentIdForTarget).toHaveBeenNthCalledWith(1, context.ctx, expect.any(Object));
            expect(agentIdForTarget).toHaveBeenCalledWith(
                context.ctx,
                expect.objectContaining({
                    descriptor: expect.objectContaining({ name: "deploy Skill" })
                })
            );
            expect(postAndAwait).toHaveBeenCalledWith(
                context.ctx,
                { agentId: "agent-sub" },
                expect.objectContaining({
                    type: "message",
                    message: expect.objectContaining({
                        text: expect.stringContaining("Deploy version 1.2.3")
                    })
                })
            );
            expect(contentText(result.toolMessage.content)).toContain("Skill executed in sandbox. Result:");
            expect(contentText(result.toolMessage.content)).toContain("Deployment complete.");
        } finally {
            await dirs.cleanup();
        }
    });

    it("throws clear error for unknown skill names", async () => {
        const dirs = await activeRootCreate();
        try {
            const tool = skillToolBuild();
            const context = contextBuild({ activeRoot: dirs.activeRoot, homeDir: dirs.homeDir });

            await expect(tool.execute({ name: "missing-skill" }, context, toolCall)).rejects.toThrow(
                "Unknown skill: missing-skill."
            );
        } finally {
            await dirs.cleanup();
        }
    });

    it("resolves duplicate names using input order priority", async () => {
        const dirs = await activeRootCreate();
        try {
            const coreSkill = skillBuild({ name: "deploy", id: "core:deploy", source: "core" });
            const configSkill = skillBuild({ name: "deploy", id: "config:deploy", source: "config" });
            await activeSkillWrite(dirs.activeRoot, coreSkill.id, "# core\nCore deploy.");
            await activeSkillWrite(dirs.activeRoot, configSkill.id, "# config\nConfig deploy.");

            const tool = skillToolBuild();
            const context = contextBuild({
                skills: [coreSkill, configSkill],
                activeRoot: dirs.activeRoot,
                homeDir: dirs.homeDir
            });

            const result = await tool.execute({ name: "deploy" }, context, toolCall);
            expect(contentText(result.toolMessage.content)).toContain("# core");
            expect(contentText(result.toolMessage.content)).not.toContain("# config");
        } finally {
            await dirs.cleanup();
        }
    });

    it("requires prompt for sandbox skills", async () => {
        const dirs = await activeRootCreate();
        try {
            const skill = skillBuild({ name: "deploy", id: "config:deploy", sandbox: true });
            await activeSkillWrite(dirs.activeRoot, skill.id, "# deploy\nDeploy instructions.");

            const tool = skillToolBuild();
            const context = contextBuild({
                skills: [skill],
                activeRoot: dirs.activeRoot,
                homeDir: dirs.homeDir
            });

            await expect(tool.execute({ name: "deploy" }, context, toolCall)).rejects.toThrow(
                'Skill "deploy" requires prompt in sandbox mode.'
            );
        } finally {
            await dirs.cleanup();
        }
    });

    it("resolves a skill by direct path", async () => {
        const dirs = await activeRootCreate();
        try {
            const skillDir = path.join(dirs.homeDir, "myskill");
            await fs.mkdir(skillDir, { recursive: true });
            await fs.writeFile(
                path.join(skillDir, "SKILL.md"),
                "---\nname: path-skill\n---\n\n# path-skill\nUse this skill."
            );

            const tool = skillToolBuild();
            const context = contextBuild({
                permissions: permissionsBuild({ workingDir: dirs.homeDir }),
                activeRoot: dirs.activeRoot,
                homeDir: dirs.homeDir
            });

            const result = await tool.execute({ name: "myskill/SKILL.md" }, context, toolCall);
            expect(contentText(result.toolMessage.content)).toContain("# path-skill");
        } finally {
            await dirs.cleanup();
        }
    });

    it("denies direct-path skill load when file is outside approved read scope", async () => {
        const dirs = await activeRootCreate();
        // Create under os.homedir() which is in sandbox read boundary deny list
        const homeBaseDir = await fs.mkdtemp(path.join(os.homedir(), ".daycare-skill-tool-deny-"));
        try {
            const skillDir = path.join(homeBaseDir, "denied");
            await fs.mkdir(skillDir, { recursive: true });
            await fs.writeFile(path.join(skillDir, "SKILL.md"), "---\nname: denied\n---\n\n# denied\nNo access.");

            const tool = skillToolBuild();
            const absoluteSkillPath = path.join(skillDir, "SKILL.md");
            const context = contextBuild({
                permissions: permissionsBuild({ workingDir: dirs.homeDir }),
                activeRoot: dirs.activeRoot,
                homeDir: dirs.homeDir
            });

            await expect(tool.execute({ name: absoluteSkillPath }, context, toolCall)).rejects.toThrow(
                /Read permission denied/
            );
        } finally {
            await dirs.cleanup();
            await fs.rm(homeBaseDir, { recursive: true, force: true });
        }
    });

    it("allows direct-path skill load for files within home directory", async () => {
        const dirs = await activeRootCreate();
        try {
            // Create skill file inside sandbox home (mounted as /home, always readable)
            const skillDir = path.join(dirs.homeDir, "custom-skills", "allowed");
            await fs.mkdir(skillDir, { recursive: true });
            await fs.writeFile(
                path.join(skillDir, "SKILL.md"),
                "---\nname: allowed\n---\n\n# allowed\nWithin home scope."
            );

            const tool = skillToolBuild();
            // Use relative path from workingDir (which is homeDir)
            const context = contextBuild({
                permissions: permissionsBuild({ workingDir: dirs.homeDir }),
                activeRoot: dirs.activeRoot,
                homeDir: dirs.homeDir
            });

            const result = await tool.execute({ name: "custom-skills/allowed/SKILL.md" }, context, toolCall);
            expect(contentText(result.toolMessage.content)).toContain("# allowed");
        } finally {
            await dirs.cleanup();
        }
    });

    it("sends connector notification for user-type agents", async () => {
        const dirs = await activeRootCreate();
        try {
            const skill = skillBuild({ name: "scheduling", id: "config:scheduling" });
            await activeSkillWrite(dirs.activeRoot, skill.id, "# scheduling\nUse this skill.");

            const sendMessage = vi.fn(async () => undefined);
            const tool = skillToolBuild();
            const context = contextBuild({
                skills: [skill],
                activeRoot: dirs.activeRoot,
                homeDir: dirs.homeDir,
                descriptor: { type: "user", connector: "telegram", userId: "u1", channelId: "c1" },
                connectorRegistry: {
                    get: () => ({ capabilities: { sendText: true }, sendMessage })
                }
            });

            await tool.execute({ name: "scheduling" }, context, toolCall);
            // Allow fire-and-forget promise to resolve
            await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
            expect(sendMessage).toHaveBeenCalledWith("c1", { text: "⚡ Skill loaded: scheduling" });
        } finally {
            await dirs.cleanup();
        }
    });

    it("skips connector notification for non-user agents", async () => {
        const dirs = await activeRootCreate();
        try {
            const skill = skillBuild({ name: "scheduling", id: "config:scheduling" });
            await activeSkillWrite(dirs.activeRoot, skill.id, "# scheduling\nUse this skill.");

            const sendMessage = vi.fn(async () => undefined);
            const tool = skillToolBuild();
            const context = contextBuild({
                skills: [skill],
                activeRoot: dirs.activeRoot,
                homeDir: dirs.homeDir,
                descriptor: { type: "cron", id: "cron-1" },
                connectorRegistry: {
                    get: () => ({ capabilities: { sendText: true }, sendMessage })
                }
            });

            await tool.execute({ name: "scheduling" }, context, toolCall);
            await new Promise((r) => setTimeout(r, 50));
            expect(sendMessage).not.toHaveBeenCalled();
        } finally {
            await dirs.cleanup();
        }
    });
});

/** Creates temp homeDir and activeRoot directories for tests. */
async function activeRootCreate(): Promise<{
    homeDir: string;
    activeRoot: string;
    cleanup: () => Promise<void>;
}> {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-skill-test-"));
    const homeDir = path.join(baseDir, "home");
    const activeRoot = path.join(baseDir, "active");
    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(activeRoot, { recursive: true });
    return {
        homeDir,
        activeRoot,
        cleanup: () => fs.rm(baseDir, { recursive: true, force: true })
    };
}

/** Writes a skill file into the active root under the activation key directory. */
async function activeSkillWrite(activeRoot: string, skillId: string, body: string): Promise<void> {
    const activationKey = skillActivationKeyBuild(skillId);
    const skillDir = path.join(activeRoot, activationKey);
    await fs.mkdir(skillDir, { recursive: true });
    const name = skillId.split(":").pop() ?? "skill";
    await fs.writeFile(
        path.join(skillDir, "SKILL.md"),
        [`---`, `name: ${name}`, `description: test skill`, `---`, "", body].join("\n")
    );
}

function contextBuild(input?: {
    permissions?: SessionPermissions;
    skills?: AgentSkill[];
    activeRoot?: string;
    homeDir?: string;
    dockerEnabled?: boolean;
    descriptor?: AgentDescriptor;
    connectorRegistry?: { get: (id: string) => unknown };
    agentSystem?: {
        agentIdForTarget?: (ctx: unknown, target: unknown) => Promise<string>;
        postAndAwait?: (
            ctx: unknown,
            target: unknown,
            item: unknown
        ) => Promise<{ responseText: string | null; type: "message" }>;
    };
}): ToolExecutionContext {
    const agentIdForTarget = input?.agentSystem?.agentIdForTarget ?? (async () => "agent-sub");
    const postAndAwait =
        input?.agentSystem?.postAndAwait ?? (async () => ({ type: "message" as const, responseText: "ok" }));
    const homeDir = input?.homeDir ?? os.tmpdir();
    const permissions = input?.permissions ?? permissionsBuild({ workingDir: homeDir });
    const mounts = input?.activeRoot ? [{ hostPath: input.activeRoot, mappedPath: "/shared/skills" }] : [];
    const sandbox = new Sandbox({
        homeDir,
        permissions,
        mounts,
        docker: input?.dockerEnabled
            ? {
                  enabled: true,
                  image: "img",
                  tag: "latest",
                  enableWeakerNestedSandbox: false,
                  readOnly: false,
                  unconfinedSecurity: false,
                  capAdd: [],
                  capDrop: [],
                  userId: "user-1"
              }
            : undefined
    });

    return {
        connectorRegistry: (input?.connectorRegistry ?? null) as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox,
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: { id: "agent-parent", descriptor: input?.descriptor } as unknown as ToolExecutionContext["agent"],
        ctx: contextForAgent({ userId: "user-1", agentId: "agent-parent" }),
        source: "test",
        messageContext: {},
        skills: input?.skills ?? [],
        agentSystem: {
            agentIdForTarget,
            postAndAwait
        } as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}

function permissionsBuild(overrides: Partial<SessionPermissions>): SessionPermissions {
    return {
        workingDir: overrides.workingDir ?? "/workspace",
        writeDirs: overrides.writeDirs ?? [overrides.workingDir ?? "/workspace"],
        ...overrides
    };
}

function skillBuild(overrides: Partial<AgentSkill> & Pick<AgentSkill, "name">): AgentSkill {
    const source = overrides.source ?? "config";
    const id = overrides.id ?? `${source}:${overrides.name}`;
    return {
        id,
        name: overrides.name,
        description: null,
        sourcePath: "/unused",
        source,
        sandbox: overrides.sandbox,
        permissions: overrides.permissions
    };
}

function contentText(content: unknown): string {
    if (!Array.isArray(content)) {
        return "";
    }
    return content
        .filter((item) => typeof item === "object" && item !== null && (item as { type?: unknown }).type === "text")
        .map((item) => (item as { text?: unknown }).text)
        .filter((value): value is string => typeof value === "string")
        .join("\n");
}
