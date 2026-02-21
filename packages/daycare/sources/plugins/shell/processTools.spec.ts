import { describe, expect, it, vi } from "vitest";
import type { SessionPermissions, ToolExecutionContext } from "@/types";
import type { ProcessCreateInput, Processes, ProcessInfo } from "../../engine/processes/processes.js";
import { buildProcessStartTool } from "./processTools.js";

describe("process_start permissions", () => {
    it("uses /tmp write scope for process sandboxing", async () => {
        let capturedPermissions: SessionPermissions | null = null;
        const create = vi.fn(async (_input: ProcessCreateInput, permissions: SessionPermissions) => {
            capturedPermissions = permissions;
            return buildProcessInfo();
        });
        const tool = buildProcessStartTool({ create } as unknown as Processes);

        await tool.execute(
            {
                command: "echo hello"
            },
            createContext({
                workingDir: "/workspace",
                writeDirs: ["/workspace", "/tmp"]
            }),
            { id: "call-0", name: "process_start" }
        );

        expect(capturedPermissions).toEqual({
            workingDir: "/workspace",
            writeDirs: ["/tmp"]
        });
    });

    it("does not mutate tool context permissions", async () => {
        const create = vi.fn(async () => buildProcessInfo());
        const tool = buildProcessStartTool({ create } as unknown as Processes);
        const permissions: SessionPermissions = {
            workingDir: "/workspace",
            writeDirs: ["/workspace", "/tmp"]
        };
        const original = {
            workingDir: permissions.workingDir,
            writeDirs: [...permissions.writeDirs]
        };
        const context = createContext(permissions);

        await tool.execute(
            {
                command: "echo hello"
            },
            context,
            { id: "call-0b", name: "process_start" }
        );

        expect(context.permissions).toEqual(original);
    });

    it("does not forward caller write grants", async () => {
        let capturedPermissions: SessionPermissions | null = null;
        const create = vi.fn(async (_input: ProcessCreateInput, permissions: SessionPermissions) => {
            capturedPermissions = permissions;
            return buildProcessInfo();
        });
        const tool = buildProcessStartTool({ create } as unknown as Processes);

        await tool.execute(
            {
                command: "echo hello"
            },
            createContext({
                workingDir: "/workspace",
                writeDirs: ["/workspace", "/tmp"]
            }),
            { id: "call-2", name: "process_start" }
        );

        expect(capturedPermissions).toEqual({
            workingDir: "/workspace",
            writeDirs: ["/tmp"]
        });
    });
});

function createContext(permissions: SessionPermissions): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        fileStore: null as unknown as ToolExecutionContext["fileStore"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: null as unknown as ToolExecutionContext["logger"],
        assistant: null,
        permissions,
        agent: null as unknown as ToolExecutionContext["agent"],
        ctx: { agentId: "agent-1", userId: "user-1" } as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}

function buildProcessInfo(): ProcessInfo {
    const now = Date.now();
    return {
        id: "process-id",
        name: "process-name",
        command: "echo hello",
        cwd: "/workspace",
        home: null,
        pid: 100,
        keepAlive: false,
        desiredState: "running",
        status: "running",
        restartCount: 0,
        createdAt: now,
        updatedAt: now,
        lastStartedAt: now,
        lastExitedAt: null,
        logPath: "/tmp/process.log"
    };
}
