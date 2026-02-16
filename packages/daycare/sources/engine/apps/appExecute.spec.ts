import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext, ToolExecutionResult } from "@/types";
import { configResolve } from "../../config/configResolve.js";
import { appExecute } from "./appExecute.js";
import type { AppDescriptor } from "./appTypes.js";

describe("appExecute", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-app-execute-"));
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it("configures app-agent permissions and passes a reviewed tool executor override", async () => {
    const config = configResolve(
      { engine: { dataDir: path.join(rootDir, "data") }, assistant: { workspaceDir: rootDir } },
      path.join(rootDir, "settings.json")
    );
    const agentId = "agent-app-1";
    const statePath = path.join(config.agentsDir, agentId, "state.json");
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(
      statePath,
      JSON.stringify({
        context: { messages: [] },
        permissions: {
          workingDir: rootDir,
          writeDirs: [rootDir],
          readDirs: [rootDir],
          network: false,
          events: false
        },
        tokens: null,
        stats: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        state: "active"
      })
    );

    const postAndAwait = vi.fn(
      async (_target: unknown, _item: unknown) =>
        ({ type: "message" as const, responseText: "App response." })
    );
    const agentIdForTarget = vi.fn(async () => agentId);
    const updateAgentPermissions = vi.fn();
    const toolResolver = {
      listTools: () => [
        { name: "read", description: "read", parameters: { type: "object", properties: {} } },
        { name: "write", description: "write", parameters: { type: "object", properties: {} } },
        { name: "exec", description: "exec", parameters: { type: "object", properties: {} } },
        { name: "cron", description: "cron", parameters: { type: "object", properties: {} } }
      ],
      execute: async () =>
        ({
          toolMessage: {
            role: "toolResult",
            toolCallId: "t1",
            toolName: "read",
            content: [{ type: "text", text: "ok" }],
            isError: false,
            timestamp: Date.now()
          },
          files: []
        }) as ToolExecutionResult
    };

    const context = {
      connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
      fileStore: null as unknown as ToolExecutionContext["fileStore"],
      auth: null as unknown as ToolExecutionContext["auth"],
      logger: console as unknown as ToolExecutionContext["logger"],
      assistant: null,
      permissions: {
        workingDir: rootDir,
        writeDirs: [rootDir],
        readDirs: [rootDir],
        network: false,
        events: false
      },
      agent: { id: "parent-agent" } as ToolExecutionContext["agent"],
      source: "test",
      messageContext: {},
      agentSystem: {
        config: { current: config },
        agentIdForTarget,
        updateAgentPermissions,
        postAndAwait,
        inferenceRouter: {} as unknown,
        toolResolver
      } as unknown as ToolExecutionContext["agentSystem"],
      heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    } as ToolExecutionContext;

    const app: AppDescriptor = {
      id: "github-reviewer",
      path: path.join(rootDir, "apps", "github-reviewer"),
      manifest: {
        name: "github-reviewer",
        title: "GitHub Reviewer",
        description: "Reviews pull requests",
        systemPrompt: "You are a focused PR review assistant."
      },
      permissions: {
        sourceIntent: "Review pull requests safely.",
        rules: {
          allow: [{ text: "Read files" }],
          deny: [{ text: "Delete files" }]
        }
      }
    };

    const result = await appExecute({
      app,
      prompt: "Review PR #42",
      context
    });
    expect(result).toEqual({ agentId, responseText: "App response." });
    expect(agentIdForTarget).toHaveBeenCalledWith({
      descriptor: {
        type: "app",
        id: expect.any(String),
        parentAgentId: "parent-agent",
        name: "github-reviewer",
        systemPrompt: "You are a focused PR review assistant.",
        appId: "github-reviewer"
      }
    });

    expect(updateAgentPermissions).toHaveBeenCalledTimes(1);
    expect(postAndAwait).toHaveBeenCalledTimes(1);
    const firstCall = postAndAwait.mock.calls[0];
    if (!firstCall) {
      throw new Error("Expected postAndAwait call");
    }
    const item = firstCall[1] as unknown;
    expect(item).toMatchObject({
      type: "message",
      message: {
        text: [
          "You are running app \"GitHub Reviewer\" (github-reviewer).",
          "Reviews pull requests",
          "",
          "Task:",
          "Review PR #42"
        ].join("\n")
      }
    });
    const override = (
      item as { toolResolverOverride: { listTools: () => Array<{ name: string }> } }
    ).toolResolverOverride;
    expect(override.listTools().map((tool) => tool.name)).toEqual(["read", "write", "exec"]);

    const updatedRaw = await fs.readFile(statePath, "utf8");
    const updated = JSON.parse(updatedRaw) as { permissions: { workingDir: string; writeDirs: string[] } };
    expect(updated.permissions.workingDir).toBe(path.join(rootDir, "apps", "github-reviewer", "data"));
    expect(updated.permissions.writeDirs).toEqual([
      path.join(rootDir, "apps", "github-reviewer", "data")
    ]);
  });
});
