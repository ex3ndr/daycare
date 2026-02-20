import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExposeTunnelProvider } from "@/types";

const execFileMock = vi.fn();

vi.mock("node:child_process", () => ({
    execFile: (...args: unknown[]) => execFileMock(...args)
}));

vi.mock("./tailscaleBinaryResolve.js", () => ({
    tailscaleBinaryResolve: vi.fn(async () => "/bin/tailscale")
}));

import { plugin } from "./plugin.js";

function execSuccess(stdout: string): void {
    execFileMock.mockImplementationOnce(
        (
            _command: string,
            _args: string[],
            _options: { windowsHide: boolean },
            callback: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
            callback(null, stdout, "");
            return undefined;
        }
    );
}

describe("tailscale plugin", () => {
    beforeEach(() => {
        execFileMock.mockReset();
    });

    it("uses machine DNS name and supports a single active endpoint", async () => {
        let registeredProvider: ExposeTunnelProvider | null = null;
        const api = {
            instance: { instanceId: "tailscale-1", pluginId: "tailscale", enabled: true },
            settings: {},
            engineSettings: {},
            logger: { warn: vi.fn() },
            auth: {},
            dataDir: "/tmp/daycare",
            registrar: {},
            exposes: {
                registerProvider: vi.fn(async (provider: ExposeTunnelProvider) => {
                    registeredProvider = provider;
                }),
                unregisterProvider: vi.fn(async () => undefined),
                listProviders: () => []
            },
            fileStore: {},
            inference: {
                complete: async () => {
                    throw new Error("Inference not available in test.");
                }
            },
            processes: {},
            mode: "runtime" as const,
            events: { emit: () => undefined }
        };

        execSuccess(JSON.stringify({ Self: { DNSName: "machine.tail123.ts.net" } }));
        const instance = await plugin.create(api as never);
        await instance.load?.();

        if (!registeredProvider) {
            throw new Error("Expected provider registration");
        }
        const provider = registeredProvider as ExposeTunnelProvider;

        execSuccess("ok");
        const created = await provider.createTunnel(3000, "public");
        expect(created.domain).toBe("machine.tail123.ts.net");

        await expect(provider.createTunnel(3001, "public")).rejects.toThrow("only one active expose endpoint");

        execSuccess("ok");
        await provider.destroyTunnel(created.domain);

        await instance.unload?.();
        expect(api.exposes.unregisterProvider).toHaveBeenCalledWith("tailscale-1");

        expect(execFileMock).toHaveBeenNthCalledWith(
            1,
            "/bin/tailscale",
            ["status", "--json"],
            { windowsHide: true },
            expect.any(Function)
        );
        expect(execFileMock).toHaveBeenNthCalledWith(
            2,
            "/bin/tailscale",
            ["funnel", "--bg", "--https", "443", "http://127.0.0.1:3000"],
            { windowsHide: true },
            expect.any(Function)
        );
        expect(execFileMock).toHaveBeenNthCalledWith(
            3,
            "/bin/tailscale",
            ["funnel", "clear", "https:443"],
            { windowsHide: true },
            expect.any(Function)
        );
    });
});
