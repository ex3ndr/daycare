import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { AgentSkill, SessionPermissions, ToolExecutionContext } from "@/types";
import { skillToolBuild } from "./skillToolBuild.js";

const toolCall = { id: "tool-1", name: "skill" };

describe("skillToolBuild", () => {
    it("returns embedded skill instructions for non-sandbox skills", async () => {
        const skillPath = await skillFileCreate("scheduling", false);
        try {
            const tool = skillToolBuild();
            const context = contextBuild({
                skills: [skillBuild(skillPath, { name: "scheduling", sandbox: false })]
            });

            const result = await tool.execute({ name: "scheduling" }, context, toolCall);
            expect(contentText(result.toolMessage.content)).toContain(
                "Skill loaded (embedded). Follow the instructions below:"
            );
            expect(contentText(result.toolMessage.content)).toContain("# scheduling");
        } finally {
            await fs.rm(path.dirname(path.dirname(skillPath)), { recursive: true, force: true });
        }
    });

    it("runs sandbox skills in a subagent and returns subagent output", async () => {
        const skillPath = await skillFileCreate("deploy", true);
        try {
            const agentIdForTarget = vi.fn(async () => "agent-sub");
            const grantPermission = vi.fn(async () => undefined);
            const postAndAwait = vi.fn(async () => ({
                type: "message" as const,
                responseText: "Deployment complete."
            }));
            const tool = skillToolBuild();
            const context = contextBuild({
                permissions: permissionsBuild({ network: true }),
                skills: [skillBuild(skillPath, { name: "deploy", sandbox: true, permissions: ["@network"] })],
                agentSystem: { agentIdForTarget, grantPermission, postAndAwait }
            });

            const result = await tool.execute({ name: "deploy", prompt: "Deploy version 1.2.3" }, context, toolCall);

            expect(agentIdForTarget).toHaveBeenCalledTimes(1);
            expect(agentIdForTarget).toHaveBeenCalledWith(
                expect.objectContaining({
                    descriptor: expect.objectContaining({ name: "deploy Skill" })
                })
            );
            expect(grantPermission).toHaveBeenCalledWith(
                { agentId: "agent-sub" },
                { kind: "network" },
                { source: "deploy Skill" }
            );
            expect(postAndAwait).toHaveBeenCalledWith(
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
            await fs.rm(path.dirname(path.dirname(skillPath)), { recursive: true, force: true });
        }
    });

    it("throws clear error for unknown skill names", async () => {
        const tool = skillToolBuild();
        const context = contextBuild();

        await expect(tool.execute({ name: "missing-skill" }, context, toolCall)).rejects.toThrow(
            "Unknown skill: missing-skill."
        );
    });

    it("resolves duplicate names using input order priority", async () => {
        const corePath = await skillFileCreateWithBody("deploy-core", false, "# core");
        const configPath = await skillFileCreateWithBody("deploy-config", false, "# config");
        try {
            const tool = skillToolBuild();
            const context = contextBuild({
                skills: [
                    skillBuild(corePath, { name: "deploy", id: "core:deploy", source: "core", sandbox: false }),
                    skillBuild(configPath, { name: "deploy", id: "config:deploy", source: "config", sandbox: false })
                ]
            });

            const result = await tool.execute({ name: "deploy" }, context, toolCall);
            expect(contentText(result.toolMessage.content)).toContain("# core");
            expect(contentText(result.toolMessage.content)).not.toContain("# config");
        } finally {
            await fs.rm(path.dirname(path.dirname(corePath)), { recursive: true, force: true });
            await fs.rm(path.dirname(path.dirname(configPath)), { recursive: true, force: true });
        }
    });

    it("requires prompt for sandbox skills", async () => {
        const skillPath = await skillFileCreate("deploy", true);
        try {
            const tool = skillToolBuild();
            const context = contextBuild({
                permissions: permissionsBuild({ network: true }),
                skills: [skillBuild(skillPath, { name: "deploy", sandbox: true })]
            });

            await expect(tool.execute({ name: "deploy" }, context, toolCall)).rejects.toThrow(
                'Skill "deploy" requires prompt in sandbox mode.'
            );
        } finally {
            await fs.rm(path.dirname(path.dirname(skillPath)), { recursive: true, force: true });
        }
    });

    it("resolves a skill by direct path", async () => {
        const skillPath = await skillFileCreate("path-skill", false);
        const workingDir = path.dirname(path.dirname(skillPath));
        const relativePath = path.relative(workingDir, skillPath);
        try {
            const tool = skillToolBuild();
            const context = contextBuild({
                permissions: permissionsBuild({ workingDir }),
                skills: []
            });

            const result = await tool.execute({ name: relativePath }, context, toolCall);
            expect(contentText(result.toolMessage.content)).toContain("# path-skill");
        } finally {
            await fs.rm(workingDir, { recursive: true, force: true });
        }
    });

    it("rejects sandbox skill permissions that exceed parent permissions", async () => {
        const skillPath = await skillFileCreate("deploy", true);
        try {
            const tool = skillToolBuild();
            const context = contextBuild({
                permissions: permissionsBuild({ network: false }),
                skills: [skillBuild(skillPath, { name: "deploy", sandbox: true, permissions: ["@network"] })]
            });

            await expect(tool.execute({ name: "deploy", prompt: "Ship it" }, context, toolCall)).rejects.toThrow(
                "Cannot attach permission"
            );
        } finally {
            await fs.rm(path.dirname(path.dirname(skillPath)), { recursive: true, force: true });
        }
    });
});

function contextBuild(input?: {
    permissions?: SessionPermissions;
    skills?: AgentSkill[];
    agentSystem?: {
        agentIdForTarget?: (target: unknown) => Promise<string>;
        grantPermission?: (target: unknown, access: unknown, options?: unknown) => Promise<void>;
        postAndAwait?: (target: unknown, item: unknown) => Promise<{ responseText: string | null; type: "message" }>;
    };
}): ToolExecutionContext {
    const agentIdForTarget = input?.agentSystem?.agentIdForTarget ?? (async () => "agent-sub");
    const grantPermission = input?.agentSystem?.grantPermission ?? (async () => undefined);
    const postAndAwait =
        input?.agentSystem?.postAndAwait ?? (async () => ({ type: "message" as const, responseText: "ok" }));

    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        fileStore: null as unknown as ToolExecutionContext["fileStore"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        permissions: input?.permissions ?? permissionsBuild({}),
        agent: { id: "agent-parent" } as unknown as ToolExecutionContext["agent"],
        agentContext: null as unknown as ToolExecutionContext["agentContext"],
        source: "test",
        messageContext: {},
        skills: input?.skills ?? [],
        agentSystem: {
            agentIdForTarget,
            grantPermission,
            postAndAwait
        } as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}

function permissionsBuild(overrides: Partial<SessionPermissions>): SessionPermissions {
    return {
        workingDir: "/workspace",
        writeDirs: ["/workspace"],
        readDirs: [],
        network: false,
        events: false,
        ...overrides
    };
}

function skillBuild(skillPath: string, overrides: Partial<AgentSkill> & Pick<AgentSkill, "name">): AgentSkill {
    const source = overrides.source ?? "config";
    const id = overrides.id ?? `${source}:${overrides.name}`;
    return {
        id,
        name: overrides.name,
        description: null,
        path: skillPath,
        source,
        sandbox: overrides.sandbox,
        permissions: overrides.permissions
    };
}

async function skillFileCreate(name: string, sandbox: boolean): Promise<string> {
    return skillFileCreateWithBody(name, sandbox, `# ${name}\nUse this skill.`);
}

async function skillFileCreateWithBody(name: string, sandbox: boolean, body: string): Promise<string> {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-skill-tool-"));
    const skillDir = path.join(baseDir, name);
    await fs.mkdir(skillDir, { recursive: true });
    const skillPath = path.join(skillDir, "SKILL.md");
    await fs.writeFile(
        skillPath,
        [
            "---",
            `name: ${name}`,
            "description: test skill",
            `sandbox: ${sandbox ? "true" : "false"}`,
            "---",
            "",
            body
        ].join("\n")
    );
    return skillPath;
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
