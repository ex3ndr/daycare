import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgentState, ToolExecutionContext } from "@/types";
import { Agent } from "../../engine/agents/agent.js";
import { contextForAgent } from "../../engine/agents/context.js";
import { AgentInbox } from "../../engine/agents/ops/agentInbox.js";
import { UserHome } from "../../engine/users/userHome.js";
import { buildMontyPythonTool } from "./tool.js";

const toolCall = { id: "tool-call-1", name: "python" };

describe("monty python tool", () => {
    let workingDir: string;

    beforeEach(async () => {
        workingDir = await fs.mkdtemp(path.join(os.tmpdir(), "monty-python-tool-"));
    });

    afterEach(async () => {
        await fs.rm(workingDir, { recursive: true, force: true });
    });

    it("executes python code with inputs", async () => {
        const tool = buildMontyPythonTool();
        const context = createContext(workingDir);

        const result = await tool.execute(
            {
                code: "x + y",
                inputs: { x: 2, y: 40 }
            },
            context,
            toolCall
        );

        expect(result.toolMessage.isError).toBe(false);
        expect(toolMessageText(result.toolMessage)).toContain("42");
    });

    it("returns tool errors for runtime exceptions", async () => {
        const tool = buildMontyPythonTool();
        const context = createContext(workingDir);

        const result = await tool.execute(
            {
                code: "1 / 0"
            },
            context,
            toolCall
        );

        expect(result.toolMessage.isError).toBe(true);
        expect(toolMessageText(result.toolMessage)).toContain("ZeroDivisionError");
    });

    it("returns tool errors for type-check failures", async () => {
        const tool = buildMontyPythonTool();
        const context = createContext(workingDir);

        const result = await tool.execute(
            {
                code: '"hello" + 1',
                typeCheck: true
            },
            context,
            toolCall
        );

        expect(result.toolMessage.isError).toBe(true);
        expect(toolMessageText(result.toolMessage)).toContain("Python type check failed");
    });
});

function createContext(workingDir: string): ToolExecutionContext {
    const agentId = createId();
    const messageContext = {};
    const descriptor = {
        type: "subagent",
        id: agentId,
        parentAgentId: "system",
        name: "system"
    } as const;
    const ctx = contextForAgent({ userId: "user-1", agentId });
    const now = Date.now();
    const state: AgentState = {
        context: { messages: [] },
        permissions: {
            workingDir,
            writeDirs: []
        },
        tokens: null,
        stats: {},
        createdAt: now,
        updatedAt: now,
        state: "active"
    };

    const agent = Agent.restore(
        ctx,
        descriptor,
        state,
        new AgentInbox(agentId),
        {} as unknown as Parameters<typeof Agent.restore>[4],
        new UserHome(path.join(workingDir, "users"), "user-1")
    );

    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        fileStore: null as unknown as ToolExecutionContext["fileStore"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        permissions: state.permissions,
        agent,
        ctx,
        source: "test",
        messageContext,
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}

function toolMessageText(message: { content: Array<{ type: string; text?: string }> }): string {
    return message.content
        .filter((entry) => entry.type === "text")
        .map((entry) => entry.text ?? "")
        .join("\n");
}
