import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Tool } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import type { Storage } from "../../../storage/storage.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { vaultSystemDocsEnsure } from "../../document/vaultSystemDocsEnsure.js";
import { UserHome } from "../../users/userHome.js";
import { contextForAgent, contextForUser } from "../context.js";
import { systemAgentPromptResolve } from "../system/systemAgentPromptResolve.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import { agentSystemPrompt } from "./agentSystemPrompt.js";

type AgentSystemPromptParameter = NonNullable<Parameters<typeof agentSystemPrompt>[0]>;

describe("agentSystemPrompt", () => {
    it("renders explicit same-turn vault persistence guidance for durable instructions", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-system-prompt-memory-rule-"));
        try {
            const userHome = new UserHome(path.join(dir, "users"), "user-1");

            const rendered = await agentSystemPrompt({
                ctx: contextForUser({ userId: "user-1" }),
                path: "/user-1/agent/helper",
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

            expect(rendered).toContain(
                "If a user gives you a durable instruction about how you should work, update `vault://system/agents` in the same turn"
            );
            expect(rendered).toContain(
                "Do not say you will remember, keep in mind, or follow a durable rule later unless you already updated the relevant vault entry in this session"
            );
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("renders plugin prompt sections and collects system prompt images", async () => {
        const context: AgentSystemPromptParameter = {
            ctx: contextForUser({ userId: "user-1" }),
            path: "/user-1/memory/memory-1",
            config: {
                kind: "memory",
                modelRole: null,
                connector: null,
                parentAgentId: null,
                foreground: false,
                name: null,
                description: null,
                systemPrompt: null,
                workspaceDir: null
            },
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

    it("returns replacement prompt for memory-agent path", async () => {
        const expected = (await agentPromptBundledRead("memory/MEMORY_AGENT.md")).trim();
        const memoryPolicy = (await agentPromptBundledRead("MEMORY_AGENT.md")).trim();

        const rendered = await agentSystemPrompt({
            ctx: contextForUser({ userId: "user-1" }),
            path: "/user-1/memory/agent-1",
            config: {
                kind: "memory",
                modelRole: null,
                connector: null,
                parentAgentId: null,
                foreground: false,
                name: null,
                description: null,
                systemPrompt: null,
                workspaceDir: null
            }
        });

        expect(rendered).toContain(expected);
        expect(rendered).toContain("## Memory Role Prompt");
        expect(rendered).toContain(memoryPolicy);
        expect(rendered).toContain("## Tool Calling");
        expect(rendered).toContain("## Skills");
    });

    it("uses the search-specific memory prompt for search agents", async () => {
        const memoryPolicy = (await agentPromptBundledRead("MEMORY_SEARCH.md")).trim();

        const rendered = await agentSystemPrompt({
            ctx: contextForUser({ userId: "user-1" }),
            path: "/user-1/cron/search-run/memory/search/0",
            config: {
                kind: "search",
                modelRole: null,
                connector: null,
                parentAgentId: null,
                foreground: false,
                name: "memory-search",
                description: null,
                systemPrompt: null,
                workspaceDir: null
            }
        });

        expect(rendered).toContain("## Memory Role Prompt");
        expect(rendered).toContain(memoryPolicy);
    });

    it("uses the compactor-specific memory prompt for compactor agents", async () => {
        const memoryPolicy = (await agentPromptBundledRead("MEMORY_COMPACTOR.md")).trim();

        const rendered = await agentSystemPrompt({
            ctx: contextForUser({ userId: "user-1" }),
            path: "/user-1/compactor/agent-1",
            config: {
                kind: "compactor",
                modelRole: null,
                connector: null,
                parentAgentId: null,
                foreground: false,
                name: "memory-compactor",
                description: null,
                systemPrompt: null,
                workspaceDir: null
            }
        });

        expect(rendered).toContain("## Memory Role Prompt");
        expect(rendered).toContain(memoryPolicy);
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
            path: "/system/architect"
        });

        expect(rendered).toContain(expected);
        expect(rendered).toContain("## Tool Calling");
        expect(rendered).toContain("## Skills");
    });

    it("renders base prompt for system agent without a registered definition", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-system-prompt-unknown-"));
        try {
            const userHome = new UserHome(path.join(dir, "users"), "user-1");

            const rendered = await agentSystemPrompt({
                ctx: contextForAgent({ userId: "user-1", agentId: "agent-system-1" }),
                path: "/system/cron",
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
        const storage = await storageOpenTest();
        try {
            const userHome = new UserHome(path.join(dir, "users"), "user-1");
            await systemPromptDocumentsWrite(storage, "user-1", {
                soul: "Soul prompt text\n",
                user: "User prompt text\n",
                agents: "Agents prompt text\n",
                memory: "Memory prompt text\n",
                tools: "Tools prompt text\n"
            });

            const agentSystem = {
                config: {
                    current: {
                        dataDir: dir,
                        usersDir: path.join(dir, "users"),
                        configDir: path.join(dir, ".daycare"),
                        agentsDir: path.join(dir, "agents"),
                        settings: {
                            providers: [{ id: "openai", enabled: true }],
                            modelFlavors: {
                                coding: {
                                    model: "openai/codex-mini",
                                    description: "Use for code generation"
                                }
                            }
                        }
                    }
                },
                storage: {
                    documents: storage.documents,
                    users: {
                        findById: async (id: string) =>
                            id === "user-1"
                                ? {
                                      id,
                                      nametag: "user-1",
                                      firstName: null,
                                      lastName: null,
                                      country: null,
                                      timezone: null,
                                      connectorKeys: [{ connectorKey: "telegram:channel-1" }]
                                  }
                                : null
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
                path: "/user-1/telegram",
                config: {
                    kind: "connector",
                    modelRole: "user",
                    connector: { name: "telegram", key: "channel-1" },
                    parentAgentId: null,
                    foreground: true,
                    name: null,
                    description: null,
                    systemPrompt: null,
                    workspaceDir: null
                },
                userHome,
                agentSystem
            });

            expect(rendered).toContain("## Skills");
            expect(rendered).toContain("Connector: telegram, channel: channel-1, user: user-1.");
            expect(rendered).toContain("Soul prompt text");
            expect(rendered).toContain("Memory prompt text");
            expect(rendered).toContain("Tools prompt text");
            expect(rendered).toContain("reply with exactly `NO_MESSAGE` as your entire text response");
            expect(rendered).toContain("If you intend to say `NO_MESSAGE`, say only `NO_MESSAGE`");
            expect(rendered).toContain(
                "Choose exactly one: either send a user-facing message, or reply with `NO_MESSAGE`"
            );
            expect(rendered).toContain(
                'Any status update such as "I started a background agent", "I\'ll report back", or "done" counts as a user-facing message'
            );
            expect(rendered).toContain(
                'if you intend to end with `NO_MESSAGE`, do not include setup narration such as "I\'ll investigate"'
            );
            expect(rendered).toContain("Start background agents before inline tool work.");
            expect(rendered).toContain("be subagent-first for almost every non-trivial request");
            expect(rendered).toContain(
                "your first substantive action must be launching `start_background_agent` or `start_background_workflow`"
            );
            expect(rendered).toContain("even when those functions are exposed inside `run_python`");
            expect(rendered).toContain("make your first `run_python` call launch the background agent or workflow");
            expect(rendered).toContain(
                "before any memory search, topology check, filesystem inspection, or other inline investigation"
            );
            expect(rendered).toContain("Silent handoffs stay silent.");
            expect(rendered).toContain(
                'do not narrate the handoff with text like "I\'ll investigate" or "I\'ll report back"'
            );
            expect(rendered).toContain("For investigation-style requests");
            expect(rendered).toContain(
                "do not ask the user for more context until a background agent has first checked"
            );
            expect(rendered).toContain("Prefer reusable workflows over ad-hoc background work.");
            expect(rendered).toContain(
                "existing core task, reusable task, permanent agent, or skill already fits the job"
            );
            expect(rendered).toContain(
                "prefer `start_background_workflow` or a reusable task over a one-off background agent"
            );
            expect(rendered).toContain("load the `tasks` skill and create a custom workflow or reusable task");
            expect(rendered).toContain("`core:software-development` and `core:plan-verify` are bundled built-in tasks");
            expect(rendered).toContain(
                'Use `task_run(taskId="core:software-development", sync=true, parameters={...})`'
            );
            expect(rendered).toContain("Do not delegate plan creation or plan validation to a subagent.");
            expect(rendered).toContain("## Model Awareness");
            expect(rendered).toContain("**OpenAI**:");
            expect(rendered).toContain("set_agent_model");
            expect(rendered).toContain('- "small": Fastest and lowest-cost path for lightweight tasks.');
            expect(rendered).toContain('- "coding": Use for code generation');
            expect(rendered).toContain("/shared/examples");
        } finally {
            storage.connection.close();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("loads prompt sections internally from runtime context", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-system-prompt-sections-"));
        const storage = await storageOpenTest();
        try {
            const userHome = new UserHome(path.join(dir, "users"), "user-1");
            const configDir = path.join(dir, ".daycare");
            const agentsDir = path.join(dir, ".agents");
            const configSkillPath = path.join(configDir, "skills", "my-skill", "SKILL.md");

            await systemPromptDocumentsWrite(storage, "user-1", {
                soul: "Soul prompt text\n",
                user: "User prompt text\n",
                agents: "Agents prompt text\n",
                memory: "Memory prompt text\n",
                tools: "Tools prompt text\n"
            });
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
                storage: {
                    documents: storage.documents,
                    users: {
                        findById: async () => null
                    }
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
                path: "/user-1/agent/helper",
                config: {
                    foreground: false,
                    name: "helper",
                    description: "Helper agent",
                    systemPrompt: "Handle long-running research.",
                    workspaceDir: null
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
            storage.connection.close();
            await rm(dir, { recursive: true, force: true });
        }
    });
});

async function systemPromptDocumentsWrite(
    storage: Storage,
    userId: string,
    input: {
        soul: string;
        user: string;
        agents: string;
        memory: string;
        tools: string;
        memoryAgent?: string;
        memorySearch?: string;
        memoryCompactor?: string;
    }
): Promise<void> {
    const ctx = contextForUser({ userId });
    const system = await vaultSystemDocsEnsure(ctx, storage);
    const docs = [
        { slug: "soul", body: input.soul },
        { slug: "user", body: input.user },
        { slug: "agents", body: input.agents },
        { slug: "memory", body: input.memory },
        { slug: "tools", body: input.tools }
    ];

    for (const doc of docs) {
        const existing = await storage.documents.findBySlugAndParent(ctx, doc.slug, system.id);
        if (!existing) {
            throw new Error(`Missing vault://system/${doc.slug} in test.`);
        }
        await storage.documents.update(ctx, existing.id, {
            body: doc.body,
            updatedAt: Date.now()
        });
    }

    const memory = await storage.documents.findBySlugAndParent(ctx, "memory", system.id);
    if (!memory) {
        throw new Error("Missing vault://system/memory in test.");
    }

    const memoryDocs = [
        { slug: "agent", body: input.memoryAgent },
        { slug: "search", body: input.memorySearch },
        { slug: "compactor", body: input.memoryCompactor }
    ];

    for (const doc of memoryDocs) {
        if (doc.body === undefined) {
            continue;
        }
        const existing = await storage.documents.findBySlugAndParent(ctx, doc.slug, memory.id);
        if (!existing) {
            throw new Error(`Missing vault://system/memory/${doc.slug} in test.`);
        }
        await storage.documents.update(ctx, existing.id, {
            body: doc.body,
            updatedAt: Date.now()
        });
    }
}
