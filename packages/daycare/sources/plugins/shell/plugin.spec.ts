import { describe, expect, it, vi } from "vitest";

import { plugin } from "./plugin.js";

function pluginApiBuild() {
    let listener: ((event: { type: string; payload: unknown }) => void) | null = null;
    const registrar = {
        registerTool: vi.fn(),
        unregisterTool: vi.fn(),
        registerCommand: vi.fn(),
        unregisterCommand: vi.fn(),
        sendMessage: vi.fn(async () => undefined)
    };
    const processes = {
        killAgentExecs: vi.fn(async () => 0),
        killAllSessionExecs: vi.fn(async () => 0),
        killSessionExecs: vi.fn(async () => 0)
    };
    const api = {
        instance: { instanceId: "shell", pluginId: "shell", enabled: true },
        settings: {},
        engineSettings: {},
        logger: { warn: vi.fn() },
        auth: {},
        dataDir: "/tmp/daycare/plugins/shell",
        registrar,
        fileStore: {},
        inference: { complete: async () => undefined },
        processes,
        engineEvents: {
            onEvent: vi.fn((next) => {
                listener = next;
                return () => {
                    listener = null;
                };
            })
        },
        mode: "runtime" as const
    };
    return {
        api,
        registrar,
        processes,
        emit: (event: { type: string; payload: unknown }) => listener?.(event)
    };
}

describe("shell plugin", () => {
    it("registers shell tools without grep/find/ls", async () => {
        const { api, registrar } = pluginApiBuild();
        const instance = await plugin.create(api as never);

        await instance.load?.();

        const registered = registrar.registerTool.mock.calls.map((call) => call[0]?.tool?.name);
        expect(registered).toEqual([
            "read",
            "read_json",
            "write",
            "edit",
            "write_output",
            "exec",
            "exec_poll",
            "exec_kill",
            "process_start",
            "process_list",
            "process_get",
            "process_stop",
            "process_stop_all"
        ]);
        expect(registered).not.toContain("grep");
        expect(registered).not.toContain("find");
        expect(registered).not.toContain("ls");

        await instance.unload?.();

        const unregistered = registrar.unregisterTool.mock.calls.map((call) => call[0]);
        expect(unregistered).toEqual([
            "read",
            "read_json",
            "write",
            "edit",
            "write_output",
            "exec",
            "exec_poll",
            "exec_kill",
            "process_start",
            "process_list",
            "process_get",
            "process_stop",
            "process_stop_all"
        ]);
        expect(unregistered).not.toContain("grep");
        expect(unregistered).not.toContain("find");
        expect(unregistered).not.toContain("ls");
    });

    it("cleans up session execs from engine lifecycle events", async () => {
        const { api, emit, processes } = pluginApiBuild();
        const instance = await plugin.create(api as never);

        await instance.load?.();

        emit({ type: "agent.session.ended", payload: { sessionId: "session-1" } });
        emit({ type: "agent.dead", payload: { sessionId: "session-2" } });
        emit({ type: "agent.dead", payload: { agentId: "agent-1" } });

        expect(processes.killSessionExecs).toHaveBeenCalledWith("session-1");
        expect(processes.killSessionExecs).toHaveBeenCalledWith("session-2");
        expect(processes.killAgentExecs).toHaveBeenCalledWith("agent-1");
    });
});
