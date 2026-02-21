import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExposeTunnelProvider } from "@/types";

const execFileMock = vi.fn();

vi.mock("node:child_process", () => ({
    execFile: (...args: unknown[]) => execFileMock(...args)
}));

import { plugin } from "./plugin.js";

function execSuccess(stdout: string): void {
    execFileMock.mockImplementationOnce(
        (
            _command: string,
            _args: string[],
            _options: { windowsHide: boolean; env: NodeJS.ProcessEnv },
            callback: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
            callback(null, stdout, "");
            return undefined;
        }
    );
}

describe("cloudflare tunnel plugin", () => {
    beforeEach(() => {
        execFileMock.mockReset();
    });

    it("starts cloudflared as a managed process and manages expose routes", async () => {
        let registeredProvider: ExposeTunnelProvider | null = null;
        const api = {
            instance: { instanceId: "cloudflare-1", pluginId: "cloudflare-tunnel", enabled: true },
            settings: {},
            engineSettings: {},
            logger: { warn: vi.fn() },
            auth: {
                getToken: vi.fn(async () => "token-123")
            },
            dataDir: "/tmp/daycare/plugins/cloudflare-1",
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
            processes: {
                defaultUserId: vi.fn(async () => "owner-user"),
                listByOwner: vi.fn(async () => []),
                removeByOwner: vi.fn(async () => 0),
                create: vi.fn(async () => undefined)
            },
            mode: "runtime" as const
        };

        execSuccess(JSON.stringify({ result: { hostname: "web.example.com" } }));
        const instance = await plugin.create(api as never);
        await instance.load?.();

        expect(api.processes.create).toHaveBeenCalledWith(
            {
                name: "cloudflared-cloudflare-1",
                command: "cloudflared tunnel --no-autoupdate run",
                cwd: "/tmp/daycare/plugins/cloudflare-1",
                home: "/tmp/daycare/plugins/cloudflare-1",
                env: { TUNNEL_TOKEN: "token-123" },
                allowedDomains: ["*.argotunnel.com", "*.cftunnel.com", "*.cloudflare.com"],
                keepAlive: true,
                owner: { type: "plugin", id: "cloudflare-1" },
                userId: "owner-user"
            },
            {
                workingDir: "/tmp/daycare/plugins/cloudflare-1",
                writeDirs: ["/tmp/daycare/plugins/cloudflare-1"]
            }
        );

        if (!registeredProvider) {
            throw new Error("Expected provider registration");
        }
        const provider = registeredProvider as ExposeTunnelProvider;

        execSuccess("ok");
        const created = await provider.createTunnel(3000, "public");
        expect(created.domain).toMatch(/^[a-z0-9]{12}\.example\.com$/);

        execSuccess("ok");
        await provider.destroyTunnel(created.domain);

        await instance.unload?.();
        expect(api.exposes.unregisterProvider).toHaveBeenCalledWith("cloudflare-1");

        expect(execFileMock).toHaveBeenNthCalledWith(
            1,
            "cloudflared",
            ["tunnel", "info", "--output", "json"],
            expect.objectContaining({
                windowsHide: true,
                env: expect.objectContaining({ TUNNEL_TOKEN: "token-123" })
            }),
            expect.any(Function)
        );
        expect(execFileMock).toHaveBeenNthCalledWith(
            2,
            "cloudflared",
            ["tunnel", "route", "dns", "daycare", created.domain, "--overwrite-dns", "--url", "http://127.0.0.1:3000"],
            expect.objectContaining({
                windowsHide: true,
                env: expect.objectContaining({ TUNNEL_TOKEN: "token-123" })
            }),
            expect.any(Function)
        );
        expect(execFileMock).toHaveBeenNthCalledWith(
            3,
            "cloudflared",
            ["tunnel", "route", "dns", "daycare", created.domain, "--delete"],
            expect.objectContaining({
                windowsHide: true,
                env: expect.objectContaining({ TUNNEL_TOKEN: "token-123" })
            }),
            expect.any(Function)
        );
    });

    it("does not create another cloudflared process when one is already desired running", async () => {
        const api = {
            instance: { instanceId: "cloudflare-1", pluginId: "cloudflare-tunnel", enabled: true },
            settings: {},
            engineSettings: {},
            logger: { warn: vi.fn() },
            auth: {
                getToken: vi.fn(async () => "token-123")
            },
            dataDir: "/tmp/daycare/plugins/cloudflare-1",
            registrar: {},
            exposes: {
                registerProvider: vi.fn(async () => undefined),
                unregisterProvider: vi.fn(async () => undefined),
                listProviders: () => []
            },
            fileStore: {},
            inference: {
                complete: async () => {
                    throw new Error("Inference not available in test.");
                }
            },
            processes: {
                defaultUserId: vi.fn(async () => "owner-user"),
                listByOwner: vi.fn(async () => [
                    {
                        id: "proc-1",
                        name: "cloudflared-cloudflare-1",
                        command: "cloudflared tunnel --no-autoupdate run",
                        cwd: "/tmp/daycare/plugins/cloudflare-1",
                        home: "/tmp/daycare/plugins/cloudflare-1",
                        pid: 1234,
                        keepAlive: true,
                        desiredState: "running",
                        status: "running",
                        restartCount: 0,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        lastStartedAt: Date.now(),
                        lastExitedAt: null,
                        logPath: "/tmp/daycare/process.log"
                    }
                ]),
                removeByOwner: vi.fn(async () => 0),
                create: vi.fn(async () => undefined)
            },
            mode: "runtime" as const
        };

        execSuccess(JSON.stringify({ result: { hostname: "web.example.com" } }));
        const instance = await plugin.create(api as never);
        await instance.load?.();

        expect(api.processes.create).not.toHaveBeenCalled();
    });
});
