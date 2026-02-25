import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Tool } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { UserHome } from "../../users/userHome.js";
import { contextForAgent, contextForUser } from "../context.js";
import { systemAgentPromptResolve } from "../system/systemAgentPromptResolve.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import { agentSystemPrompt } from "./agentSystemPrompt.js";

type AgentSystemPromptParameter = NonNullable<Parameters<typeof agentSystemPrompt>[0]>;

describe("agentSystemPrompt", () => {
    it("renders plugin prompt sections and collects system prompt images", async () => {
        const context: AgentSystemPromptParameter = {
            ctx: contextForUser({ userId: "user-1" }),
            descriptor: { type: "memory-agent", id: "memory-1" },
            pluginPrompts: [
                { text: "Telegram profile available.", images: ["/tmp/downloads/profile-telegram-1.jpg"] },
                { text: "Preferred language: French." }
            ]
        };

        const rendered = await agentSystemPrompt(context);

        expect(rendered).toContain("## Plugin Context");
        expect(rendered).toContain("Telegram profile available.");
        expect(rendered).toContain("Preferred language: French.");
        expect(context.systemPromptImages).toEqual(["/tmp/downloads/profile-telegram-1.jpg"]);
    });

    it("returns replacement prompt for memory-agent descriptor", async () => {
        const expected = (await agentPromptBundledRead("memory/MEMORY_AGENT.md")).trim();

        const rendered = await agentSystemPrompt({
            ctx: contextForUser({ userId: "user-1" }),
            descriptor: { type: "memory-agent", id: "agent-1" }
        });

        expect(rendered).toContain(expected);
        expect(rendered).toContain("## Tool Calling");
        expect(rendered).toContain("## Skills");
    });

    it("returns replacement prompt for architect system agent", async () => {
        const resolved = await systemAgentPromptResolve("architect");
        if (!resolved) {
            // Some builds register only non-replacement system agents.
            expect(resolved).toBeNull();
            return;
        }
        const expected = resolved.systemPrompt.trim();

        const rendered = await agentSystemPrompt({
            ctx: contextForUser({ userId: "user-1" }),
            descriptor: { type: "system", tag: "architect" }
        });

        expect(rendered).toContain(expected);
        expect(rendered).toContain("## Tool Calling");
        expect(rendered).toContain("## Skills");
    });

    it("renders base prompt for system agent without a registered definition", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-system-prompt-unknown-"));
        try {
            const userHome = new UserHome(path.join(dir, "users"), "user-1");
            await mkdir(userHome.knowledge, { recursive: true });
            await writeFile(path.join(userHome.knowledge, "SOUL.md"), "soul\n", "utf8");
            await writeFile(path.join(userHome.knowledge, "USER.md"), "user\n", "utf8");
            await writeFile(path.join(userHome.knowledge, "AGENTS.md"), "agents\n", "utf8");
            await writeFile(path.join(userHome.knowledge, "TOOLS.md"), "tools\n", "utf8");

            const rendered = await agentSystemPrompt({
                ctx: contextForAgent({ userId: "user-1", agentId: "agent-system-1" }),
                descriptor: { type: "system", tag: "cron" },
                userHome,
                agentSystem: {
                    config: {
                        current: {
                            configDir: dir
                        }
                    },
                    toolResolver: { listTools: () => [], listToolsForAgent: () => [] }
                } as unknown as NonNullable<AgentSystemPromptParameter["agentSystem"]>
            });

            expect(rendered.length).toBeGreaterThan(0);
            expect(rendered).not.toContain("## Agent Prompt");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("renders bundled templates with prompt files from agent system data dir", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-system-prompt-build-"));
        try {
            const userHome = new UserHome(path.join(dir, "users"), "user-1");
            const soulPath = path.join(userHome.knowledge, "SOUL.md");
            const userPath = path.join(userHome.knowledge, "USER.md");
            const agentsPath = path.join(userHome.knowledge, "AGENTS.md");
            const toolsPath = path.join(userHome.knowledge, "TOOLS.md");

            await mkdir(userHome.knowledge, { recursive: true });
            await writeFile(soulPath, "Soul prompt text\n", "utf8");
            await writeFile(userPath, "User prompt text\n", "utf8");
            await writeFile(agentsPath, "Agents prompt text\n", "utf8");
            await writeFile(toolsPath, "Tools prompt text\n", "utf8");

            const agentSystem = {
                config: {
                    current: {
                        dataDir: dir,
                        usersDir: path.join(dir, "users"),
                        configDir: path.join(dir, ".daycare"),
                        agentsDir: path.join(dir, "agents"),
                        settings: {
                            providers: [{ id: "openai", enabled: true }]
                        }
                    }
                },
                toolResolver: {
                    listTools: () => [],
                    listToolsForAgent: () => []
                }
            } as unknown as NonNullable<AgentSystemPromptParameter["agentSystem"]>;

            const rendered = await agentSystemPrompt({
                provider: "openai",
                model: "gpt-4.1",
                ctx: contextForAgent({ userId: "user-1", agentId: "agent-user-1" }),
                permissions: {
                    workingDir: "/tmp/workspace",
                    writeDirs: ["/tmp/workspace"]
                },
                descriptor: {
                    type: "user",
                    connector: "telegram",
                    channelId: "channel-1",
                    userId: "user-1"
                },
                userHome,
                agentSystem
            });

            expect(rendered).toContain("## Skills");
            expect(rendered).toContain("Connector: telegram, channel: channel-1, user: user-1.");
            expect(rendered).toContain("Soul prompt text");
            expect(rendered).toContain("Tools prompt text");
            expect(rendered).toContain("## Model Awareness");
            expect(rendered).toContain("**OpenAI**:");
            expect(rendered).toContain("set_agent_model");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("loads prompt sections internally from runtime context", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-system-prompt-sections-"));
        try {
            const userHome = new UserHome(path.join(dir, "users"), "user-1");
            const soulPath = path.join(userHome.knowledge, "SOUL.md");
            const userPath = path.join(userHome.knowledge, "USER.md");
            const agentsPath = path.join(userHome.knowledge, "AGENTS.md");
            const toolsPath = path.join(userHome.knowledge, "TOOLS.md");
            const configDir = path.join(dir, ".daycare");
            const agentsDir = path.join(dir, ".agents");
            const configSkillPath = path.join(configDir, "skills", "my-skill", "SKILL.md");

            await mkdir(userHome.knowledge, { recursive: true });
            await writeFile(soulPath, "Soul prompt text\n", "utf8");
            await writeFile(userPath, "User prompt text\n", "utf8");
            await writeFile(agentsPath, "Agents prompt text\n", "utf8");
            await writeFile(toolsPath, "Tools prompt text\n", "utf8");
            await mkdir(path.dirname(configSkillPath), { recursive: true });
            await writeFile(
                configSkillPath,
                "---\nname: config-skill\ndescription: Config skill\n---\nUse this skill for config work.\n",
                "utf8"
            );
            const agentSystem = {
                config: {
                    current: {
                        dataDir: dir,
                        usersDir: path.join(dir, "users"),
                        configDir,
                        agentsDir,
                        settings: {
                            providers: [{ id: "openai", enabled: true }]
                        }
                    }
                },
                pluginManager: {
                    listRegisteredSkills: () => []
                },
                connectorRegistry: {
                    get: () => null
                },
                toolResolver: {
                    listTools: () => [
                        {
                            name: "hidden_tool",
                            description: "Hidden tool",
                            parameters: {}
                        } as unknown as Tool,
                        {
                            name: "run_python",
                            description: "Python execution",
                            parameters: {}
                        } as unknown as Tool
                    ],
                    listToolsForAgent: () => [
                        {
                            name: "run_python",
                            description: "Python execution",
                            parameters: {}
                        } as unknown as Tool
                    ]
                }
            } as unknown as NonNullable<AgentSystemPromptParameter["agentSystem"]>;

            const rendered = await agentSystemPrompt({
                provider: "openai",
                model: "gpt-4.1",
                ctx: contextForAgent({ userId: "user-1", agentId: "agent-runtime-1" }),
                permissions: {
                    workingDir: "/tmp/workspace",
                    writeDirs: ["/tmp/workspace"]
                },
                descriptor: {
                    type: "permanent",
                    id: "agent-id",
                    name: "helper",
                    description: "Helper agent",
                    systemPrompt: "Handle long-running research."
                },
                userHome,
                agentSystem
            });

            expect(rendered).toContain("<name>config-skill</name>");
            expect(rendered).toContain("## Agent Prompt");
            expect(rendered).toContain("Handle long-running research.");
            expect(rendered).toContain("## Python Execution");
            expect(rendered).not.toContain("hidden_tool");
            expect(rendered).not.toContain("If you include `<say>` in the same response");
            expect(rendered).not.toContain("you MUST emit `<say>` with your response");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
