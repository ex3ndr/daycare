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

    it("supports shipped math and regex modules", async () => {
        const tool = buildMontyPythonTool();
        const context = createContext(workingDir);

        const result = await tool.execute(
            {
                code: 'import math\nimport re\nstr(math.sqrt(81)) + ":" + re.sub("a", "b", "aardvark")'
            },
            context,
            toolCall
        );

        expect(result.toolMessage.isError).toBe(false);
        expect(toolMessageText(result.toolMessage)).toContain("bbrdvbrk");
        expect(toolMessageText(result.toolMessage)).toContain("9");
    });

    it("does not expose host environment variables through os.environ", async () => {
        const tool = buildMontyPythonTool();
        const context = createContext(workingDir);
        process.env.DAYCARE_TEST_LEAK = "from-host";

        try {
            const result = await tool.execute(
                {
                    code: 'import os\nos.environ.get("DAYCARE_TEST_LEAK")'
                },
                context,
                toolCall
            );

            expect(result.toolMessage.isError).toBe(true);
            expect(toolMessageText(result.toolMessage)).toContain("os.environ");
            expect(toolMessageText(result.toolMessage)).not.toContain("from-host");
        } finally {
            delete process.env.DAYCARE_TEST_LEAK;
        }
    });
});

function createContext(workingDir: string): ToolExecutionContext {
    const agentId = createId();
    const messageContext = {};
    const ctx = contextForAgent({ userId: "user-1", agentId });
    const now = Date.now();
    const state: AgentState = {
        context: { messages: [] },
        permissions: {
            workingDir,
            writeDirs: []
        },
        createdAt: now,
        updatedAt: now,
        state: "active"
    };

    const agent = Agent.restore(
        ctx,
        `/user-1/sub/${agentId}`,
        {
            foreground: false,
            name: "system",
            description: null,
            systemPrompt: null,
            workspaceDir: null
        },
        state,
        new AgentInbox(agentId),
        {
            config: {
                current: {
                    settings: {
                        docker: {
                            readOnly: false,
                            unconfinedSecurity: false,
                            capAdd: [],
                            capDrop: [],
                            allowLocalNetworkingForUsers: [],
                            isolatedDnsServers: ["1.1.1.1", "8.8.8.8"],
                            localDnsServers: []
                        },
                        sandbox: {
                            backend: "docker"
                        },
                        opensandbox: {
                            timeoutSeconds: 600
                        }
                    }
                }
            },
            extraMountsForUserId: () => []
        } as unknown as Parameters<typeof Agent.restore>[5],
        new UserHome(path.join(workingDir, "users"), "user-1")
    );

    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent,
        ctx,
        source: "test",
        messageContext,
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"]
    };
}

function toolMessageText(message: { content: Array<{ type: string; text?: string }> }): string {
    return message.content
        .filter((entry) => entry.type === "text")
        .map((entry) => entry.text ?? "")
        .join("\n");
}
