import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { contextForAgent } from "../../agents/context.js";
import { acpSessionStartToolBuild } from "./acpSessionStartToolBuild.js";

describe("acpSessionStartToolBuild", () => {
    it("starts a session using the workspace cwd by default", async () => {
        const create = vi.fn(async () => ({
            id: "acp-1",
            remoteSessionId: "remote-1",
            userId: "user-1",
            ownerAgentId: "agent-1",
            ownerAgentName: "owner",
            description: "Review branch",
            command: "codex-acp",
            args: [],
            cwd: "/workspace",
            permissionMode: "allow",
            createdAt: 1,
            updatedAt: 1
        }));
        const tool = acpSessionStartToolBuild({ create } as never);
        const context = contextBuild("/workspace");

        const result = await tool.execute({ description: "Review branch", command: "codex-acp" }, context, {
            id: "tool-1",
            name: "acp_session_start"
        });

        expect(create).toHaveBeenCalledWith(
            expect.objectContaining({
                cwd: "/workspace",
                ownerAgentId: "agent-1",
                description: "Review branch",
                command: "codex-acp"
            })
        );
        expect(result.typedResult.sessionId).toBe("acp-1");
    });

    it("rejects cwd values outside the workspace", async () => {
        const tool = acpSessionStartToolBuild({ create: vi.fn() } as never);
        const context = contextBuild("/workspace");

        await expect(
            tool.execute({ description: "Review branch", command: "codex-acp", cwd: "../outside" }, context, {
                id: "tool-1",
                name: "acp_session_start"
            })
        ).rejects.toThrow("Path is outside the workspace.");
    });
});

function contextBuild(workingDir: string): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: { workingDir } as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: {
            id: "agent-1",
            path: "/user-1/agent/agent-1",
            config: {
                foreground: false,
                name: "owner",
                description: null,
                systemPrompt: null,
                workspaceDir: null
            }
        } as unknown as ToolExecutionContext["agent"],
        ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
        source: "test",
        messageContext: {},
        agentSystem: {} as ToolExecutionContext["agentSystem"]
    };
}
