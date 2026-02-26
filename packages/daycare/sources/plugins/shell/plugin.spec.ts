import { describe, expect, it, vi } from "vitest";

import { plugin } from "./plugin.js";

function pluginApiBuild() {
    const registrar = {
        registerTool: vi.fn(),
        unregisterTool: vi.fn(),
        registerCommand: vi.fn(),
        unregisterCommand: vi.fn(),
        sendMessage: vi.fn(async () => undefined)
    };
    const api = {
        instance: { instanceId: "shell", pluginId: "shell", enabled: true },
        settings: {},
        engineSettings: {},
        logger: { warn: vi.fn() },
        auth: {},
        dataDir: "/tmp/daycare/plugins/shell",
        registrar,
        exposes: {
            registerProvider: async () => undefined,
            unregisterProvider: async () => undefined,
            listProviders: () => []
        },
        fileStore: {},
        inference: { complete: async () => undefined },
        processes: {},
        mode: "runtime" as const
    };
    return { api, registrar };
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
});
