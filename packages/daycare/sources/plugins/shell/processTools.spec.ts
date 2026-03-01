import { describe, expect, it, vi } from "vitest";
import type { SessionPermissions, ToolExecutionContext } from "@/types";
import type { ProcessCreateInput, Processes, ProcessInfo } from "../../engine/processes/processes.js";
import {
    buildProcessGetTool,
    buildProcessListTool,
    buildProcessStartTool,
    buildProcessStopAllTool,
    buildProcessStopTool
} from "./processTools.js";

describe("process_start permissions", () => {
    it("accepts empty allowedDomains in process_start schema", () => {
        const tool = buildProcessStartTool({ create: vi.fn(async () => buildProcessInfo()) } as unknown as Processes);
        const parameters = tool.tool.parameters as {
            properties?: {
                allowedDomains?: { minItems?: number };
            };
        };

        expect(parameters.properties?.allowedDomains?.minItems).toBeUndefined();
    });

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

        expect(context.sandbox.permissions).toEqual(original);
    });

    it("forwards explicit empty allowedDomains", async () => {
        const create = vi.fn(async (_input: ProcessCreateInput) => {
            return buildProcessInfo();
        });
        const tool = buildProcessStartTool({ create } as unknown as Processes);

        await tool.execute(
            {
                command: "echo hello",
                allowedDomains: []
            },
            createContext({
                workingDir: "/workspace",
                writeDirs: ["/workspace", "/tmp"]
            }),
            { id: "call-0c", name: "process_start" }
        );

        expect(create).toHaveBeenCalledOnce();
        const firstCall = create.mock.calls[0]?.[0] as ProcessCreateInput | undefined;
        expect(firstCall?.allowedDomains).toEqual([]);
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

describe("process management user scope", () => {
    it("process_list uses caller context", async () => {
        const listForContext = vi.fn(async () => []);
        const tool = buildProcessListTool({ listForContext } as unknown as Processes);

        await tool.execute({}, createContext({ workingDir: "/workspace", writeDirs: ["/tmp"] }), {
            id: "call-list",
            name: "process_list"
        });

        expect(listForContext).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1" }));
    });

    it("process_get uses caller context", async () => {
        const getForContext = vi.fn(async () => buildProcessInfo());
        const tool = buildProcessGetTool({ getForContext } as unknown as Processes);

        await tool.execute(
            { processId: "process-id" },
            createContext({ workingDir: "/workspace", writeDirs: ["/tmp"] }),
            { id: "call-get", name: "process_get" }
        );

        expect(getForContext).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1" }), "process-id");
    });

    it("process_stop uses caller context", async () => {
        const stopForContext = vi.fn(async () => ({ ...buildProcessInfo(), status: "stopped" as const }));
        const tool = buildProcessStopTool({ stopForContext } as unknown as Processes);

        await tool.execute(
            { processId: "process-id", signal: "SIGINT" },
            createContext({ workingDir: "/workspace", writeDirs: ["/tmp"] }),
            { id: "call-stop", name: "process_stop" }
        );

        expect(stopForContext).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user-1" }),
            "process-id",
            "SIGINT"
        );
    });

    it("process_stop_all uses caller context", async () => {
        const stopAllForContext = vi.fn(async () => []);
        const tool = buildProcessStopAllTool({ stopAllForContext } as unknown as Processes);

        await tool.execute({ signal: "SIGTERM" }, createContext({ workingDir: "/workspace", writeDirs: ["/tmp"] }), {
            id: "call-stop-all",
            name: "process_stop_all"
        });

        expect(stopAllForContext).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1" }), "SIGTERM");
    });
});

function createContext(permissions: SessionPermissions): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: { permissions } as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: null as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: null as unknown as ToolExecutionContext["agent"],
        ctx: { agentId: "agent-1", userId: "user-1" } as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"]
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
