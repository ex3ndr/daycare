import { afterEach, describe, expect, it, vi } from "vitest";
import { plugin } from "./plugin.js";

describe("shell plugin", () => {
    const originalCi = process.env.CI;

    afterEach(() => {
        if (originalCi === undefined) {
            delete process.env.CI;
            return;
        }
        process.env.CI = originalCi;
    });

    it("registers run_tests outside CI", async () => {
        delete process.env.CI;
        const registerTool = vi.fn();
        const instance = await plugin.create(apiCreate(registerTool) as never);

        await instance.load?.();

        const names = registerTool.mock.calls
            .map((call) => call[0] as { tool?: { name?: string } })
            .map((definition) => definition.tool?.name)
            .filter((name): name is string => Boolean(name));
        expect(names).toContain("run_tests");
    });

    it("does not register run_tests in CI", async () => {
        process.env.CI = "1";
        const registerTool = vi.fn();
        const instance = await plugin.create(apiCreate(registerTool) as never);

        await instance.load?.();

        const names = registerTool.mock.calls
            .map((call) => call[0] as { tool?: { name?: string } })
            .map((definition) => definition.tool?.name)
            .filter((name): name is string => Boolean(name));
        expect(names).not.toContain("run_tests");
    });
});

function apiCreate(registerTool: ReturnType<typeof vi.fn>) {
    return {
        instance: { instanceId: "shell-1", pluginId: "shell", enabled: true },
        settings: {},
        engineSettings: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        auth: {},
        dataDir: "/tmp/daycare/plugins/shell-1",
        tmpDir: "/tmp/daycare/plugins/shell-1/tmp",
        registrar: {
            registerTool,
            unregisterTool: vi.fn()
        },
        exposes: {},
        fileStore: {},
        inference: {},
        processes: {},
        mode: "runtime" as const,
        events: { emit: vi.fn() }
    };
}
