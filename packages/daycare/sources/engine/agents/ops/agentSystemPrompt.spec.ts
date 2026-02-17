import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Tool } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";

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
      const soulPath = path.join(dir, "SOUL.md");
      const userPath = path.join(dir, "USER.md");
      const agentsPath = path.join(dir, "AGENTS.md");
      const toolsPath = path.join(dir, "TOOLS.md");
      const memoryPath = path.join(dir, "MEMORY.md");

      await writeFile(soulPath, "Soul prompt text\n", "utf8");
      await writeFile(userPath, "User prompt text\n", "utf8");
      await writeFile(agentsPath, "Agents prompt text\n", "utf8");
      await writeFile(toolsPath, "Tools prompt text\n", "utf8");
      await writeFile(memoryPath, "Memory prompt text\n", "utf8");

      const agentSystem = {
        config: {
          current: {
            dataDir: dir,
            configDir: path.join(dir, ".daycare"),
            agentsDir: path.join(dir, "agents"),
            workspaceDir: "/tmp/workspace",
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
          workspaceDir: "/tmp/workspace",
          workingDir: "/tmp/workspace",
          writeDirs: ["/tmp/workspace"],
          readDirs: ["/tmp/workspace"],
          network: false,
          events: false
        },
        descriptor: {
          type: "user",
          connector: "telegram",
          channelId: "channel-1",
          userId: "user-1"
        },
        agentSystem
      });

      expect(rendered).toContain("## Skills");
      expect(rendered).toContain("Connector: telegram, channel: channel-1, user: user-1.");
      expect(rendered).toContain("Soul prompt text");
      expect(rendered).toContain("Tools prompt text");
      expect(rendered).toContain("Memory prompt text");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("loads prompt sections internally from runtime context", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-system-prompt-sections-"));
    try {
      const soulPath = path.join(dir, "SOUL.md");
      const userPath = path.join(dir, "USER.md");
      const agentsPath = path.join(dir, "AGENTS.md");
      const toolsPath = path.join(dir, "TOOLS.md");
      const memoryPath = path.join(dir, "MEMORY.md");
      const configDir = path.join(dir, ".daycare");
      const agentsDir = path.join(dir, ".agents");
      const configSkillPath = path.join(configDir, "skills", "my-skill", "SKILL.md");

      await writeFile(soulPath, "Soul prompt text\n", "utf8");
      await writeFile(userPath, "User prompt text\n", "utf8");
      await writeFile(agentsPath, "Agents prompt text\n", "utf8");
      await writeFile(toolsPath, "Tools prompt text\n", "utf8");
      await writeFile(memoryPath, "Memory prompt text\n", "utf8");
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
            configDir,
            agentsDir,
            workspaceDir: "/tmp/workspace",
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
          workspaceDir: "/tmp/workspace",
          workingDir: "/tmp/workspace",
          writeDirs: ["/tmp/workspace"],
          readDirs: ["/tmp/workspace"],
          network: false,
          events: false
        },
        descriptor: {
          type: "permanent",
          id: "agent-id",
          name: "helper",
          description: "Helper agent",
          systemPrompt: "Handle long-running research."
        },
        agentSystem
      });

      expect(rendered).toContain("<name>config-skill</name>");
      expect(rendered).toContain("## Agent Prompt");
      expect(rendered).toContain("Handle long-running research.");
      expect(rendered).toContain("## Python Execution");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
