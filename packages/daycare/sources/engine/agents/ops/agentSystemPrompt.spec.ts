import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Tool } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";

import { UserHome } from "../../users/userHome.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import { agentSystemPrompt } from "./agentSystemPrompt.js";

type AgentSystemPromptParameter = NonNullable<Parameters<typeof agentSystemPrompt>[0]>;

describe("agentSystemPrompt", () => {
    it("returns replacement prompt for architect system agent", async () => {
        const expected = (await agentPromptBundledRead("ARCHITECT.md")).trim();
        const rendered = await agentSystemPrompt({
            descriptor: {
                type: "system",
                tag: "architect"
            }
        });

        expect(rendered).toBe(expected);
    });

    it("throws when system agent tag is unknown", async () => {
        await expect(
            agentSystemPrompt({
                descriptor: {
                    type: "system",
                    tag: "unknown-system-agent"
                }
            })
        ).rejects.toThrow("Unknown system agent tag: unknown-system-agent");
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
                        features: {
                            noTools: false,
                            rlm: false,
                            say: false
                        }
                    }
                },
                toolResolver: {
                    listTools: () => []
                }
            } as unknown as NonNullable<AgentSystemPromptParameter["agentSystem"]>;

            const rendered = await agentSystemPrompt({
                provider: "openai",
                model: "gpt-4.1",
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
                        features: {
                            noTools: true,
                            rlm: true,
                            say: true
                        }
                    }
                },
                pluginManager: {
                    listRegisteredSkills: () => []
                },
                connectorRegistry: {
                    get: () => null
                },
                crons: {
                    listTasks: async () => []
                },
                toolResolver: {
                    listTools: () => [
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
            expect(rendered).not.toContain("If you include `<say>` in the same response");
            expect(rendered).not.toContain("you MUST emit `<say>` with your response");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
