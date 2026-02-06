import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import { buildExecTool } from "./tool.js";
import { Agent } from "../../engine/agents/agent.js";
import { AgentInbox } from "../../engine/agents/ops/agentInbox.js";
import { agentDescriptorBuild } from "../../engine/agents/ops/agentDescriptorBuild.js";
import type { AgentState, ToolExecutionContext } from "@/types";
import { createId } from "@paralleldrive/cuid2";

const toolCall = { id: "tool-call-1", name: "exec" };

describe("exec tool allowedDomains", () => {
  let workingDir: string;

  beforeEach(async () => {
    workingDir = await fs.mkdtemp(path.join(os.tmpdir(), "exec-tool-test-"));
  });

  afterEach(async () => {
    await fs.rm(workingDir, { recursive: true, force: true });
  });

  it("throws when allowedDomains provided without network permission", async () => {
    const tool = buildExecTool();
    const context = createContext(workingDir, false);

    await expect(
      tool.execute(
        { command: "echo ok", allowedDomains: ["example.com"] },
        context,
        toolCall
      )
    ).rejects.toThrow("Network permission is required");
  });

  it("throws when packageManagers provided without network permission", async () => {
    const tool = buildExecTool();
    const context = createContext(workingDir, false);

    await expect(
      tool.execute(
        { command: "echo ok", packageManagers: ["node"] },
        context,
        toolCall
      )
    ).rejects.toThrow("Network permission is required");
  });

  it("throws when allowedDomains includes '*'", async () => {
    const tool = buildExecTool();
    const context = createContext(workingDir, true);

    await expect(
      tool.execute(
        { command: "echo ok", allowedDomains: ["*"] },
        context,
        toolCall
      )
    ).rejects.toThrow("Wildcard");
  });

  it("only allows exact domain unless wildcard subdomain is listed", async () => {
    const tool = buildExecTool();
    const context = createContext(workingDir, true);

    const allowedResult = await tool.execute(
      {
        command: "curl -I -sS https://google.com",
        allowedDomains: ["google.com"],
        timeoutMs: 30_000
      },
      context,
      toolCall
    );
    const allowedText = allowedResult.toolMessage.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n");
    expect(allowedResult.toolMessage.isError).toBe(false);
    expect(allowedText).toContain("HTTP/");

    const blockedResult = await tool.execute(
      {
        command: "curl -I -sS https://www.google.com",
        allowedDomains: ["google.com"],
        timeoutMs: 30_000
      },
      context,
      toolCall
    );
    const blockedText = blockedResult.toolMessage.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n");
    expect(blockedResult.toolMessage.isError).toBe(true);
    expect(blockedText).toContain("CONNECT tunnel failed");
  });

  it("maps HOME to provided home path", async () => {
    const tool = buildExecTool();
    const context = createContext(workingDir, false);
    const home = path.join(workingDir, ".daycare-home");

    const result = await tool.execute(
      {
        command: "printf '%s' \"$HOME\"",
        home
      },
      context,
      toolCall
    );
    const text = result.toolMessage.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n");
    const expectedHome = await fs.realpath(home);
    expect(result.toolMessage.isError).toBe(false);
    expect(text).toContain(`stdout:\n${expectedHome}`);
  });
});

function createContext(workingDir: string, network: boolean): ToolExecutionContext {
  const agentId = createId();
  const messageContext = {};
  const descriptor = agentDescriptorBuild("system", messageContext, agentId);
  const now = Date.now();
  const state: AgentState = {
    context: { messages: [] },
    permissions: {
      workingDir,
      writeDirs: [],
      readDirs: [],
      network
    },
    tokens: null,
    stats: {},
    createdAt: now,
    updatedAt: now,
    state: "active"
  };
  const agent = Agent.restore(
    agentId,
    descriptor,
    state,
    new AgentInbox(agentId),
    {} as unknown as Parameters<typeof Agent.restore>[4]
  );
  return {
    connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
    fileStore: null as unknown as ToolExecutionContext["fileStore"],
    auth: null as unknown as ToolExecutionContext["auth"],
    logger: console as unknown as ToolExecutionContext["logger"],
    assistant: null,
    permissions: state.permissions,
    agent,
    source: "test",
    messageContext,
    agentSystem: null as unknown as ToolExecutionContext["agentSystem"],
    heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
  };
}
