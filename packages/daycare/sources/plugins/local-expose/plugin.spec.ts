import { describe, expect, it, vi } from "vitest";

import type { ExposeTunnelProvider } from "@/types";

import { plugin } from "./plugin.js";

describe("local-expose plugin", () => {
    it("onboarding uses default port when omitted", async () => {
        const prompt = {
            input: vi.fn().mockResolvedValueOnce("local.example.test").mockResolvedValueOnce("")
        };
        const result = await plugin.onboarding?.({ prompt } as never);
        expect(result).toEqual({
            settings: {
                domain: "local.example.test",
                port: 18221
            }
        });
    });

    it("onboarding accepts custom port", async () => {
        const prompt = {
            input: vi.fn().mockResolvedValueOnce("local.example.test").mockResolvedValueOnce("18080")
        };
        const result = await plugin.onboarding?.({ prompt } as never);
        expect(result).toEqual({
            settings: {
                domain: "local.example.test",
                port: 18080
            }
        });
    });

    it("registers provider and starts local forwarder process on create", async () => {
        let registeredProvider: ExposeTunnelProvider | null = null;
        const api = {
            instance: { instanceId: "local-expose-1", pluginId: "local-expose", enabled: true },
            settings: { domain: "local.example.test" },
            engineSettings: {},
            logger: { warn: vi.fn() },
            auth: {},
            dataDir: "/tmp/daycare/plugins/local-expose-1",
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

        const instance = await plugin.create(api as never);
        await instance.load?.();

        if (!registeredProvider) {
            throw new Error("Expected provider registration");
        }
        const provider = registeredProvider as ExposeTunnelProvider;

        const created = await provider.createTunnel(3000, "public");
        expect(created).toEqual({ domain: "local.example.test" });
        expect(api.processes.create).toHaveBeenCalledTimes(1);
        expect(api.processes.create).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "local-expose-local-expose-1-3000",
                keepAlive: true,
                allowLocalBinding: true,
                owner: { type: "plugin", id: "local-expose-1" },
                cwd: "/tmp/daycare/plugins/local-expose-1",
                home: "/tmp/daycare/plugins/local-expose-1",
                allowedDomains: ["127.0.0.1", "localhost"]
            }),
            {
                workingDir: "/tmp/daycare/plugins/local-expose-1",
                writeDirs: ["/tmp/daycare/plugins/local-expose-1"]
            }
        );

        const createdCommand = (api.processes.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.command;
        expect(createdCommand).toContain("localTunnelForwarderEntry.js");
        expect(createdCommand).toContain("3000");
        expect(createdCommand).toContain("18221");

        await provider.destroyTunnel(created.domain);
        expect(api.processes.removeByOwner).toHaveBeenCalledWith({
            type: "plugin",
            id: "local-expose-1"
        });

        await instance.unload?.();
        expect(api.exposes.unregisterProvider).toHaveBeenCalledWith("local-expose-1");
    });

    it("replaces existing forwarder process before creating a tunnel", async () => {
        let registeredProvider: ExposeTunnelProvider | null = null;
        const api = {
            instance: { instanceId: "local-expose-1", pluginId: "local-expose", enabled: true },
            settings: { domain: "local.example.test" },
            engineSettings: {},
            logger: { warn: vi.fn() },
            auth: {},
            dataDir: "/tmp/daycare/plugins/local-expose-1",
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
                listByOwner: vi.fn(async () => [
                    {
                        id: "proc-1",
                        name: "local-expose-local-expose-1-3000",
                        command: "node /tmp/daycare/plugins/local-expose-1/localTunnelForwarderEntry.js",
                        cwd: "/tmp/daycare/plugins/local-expose-1",
                        home: "/tmp/daycare/plugins/local-expose-1",
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

        const instance = await plugin.create(api as never);
        await instance.load?.();

        if (!registeredProvider) {
            throw new Error("Expected provider registration");
        }
        const provider = registeredProvider as ExposeTunnelProvider;
        await provider.createTunnel(3000, "public");

        expect(api.processes.removeByOwner).toHaveBeenCalledWith({
            type: "plugin",
            id: "local-expose-1"
        });
        expect(api.processes.create).toHaveBeenCalledTimes(1);
    });

    it("supports only one active domain at a time", async () => {
        let registeredProvider: ExposeTunnelProvider | null = null;
        const api = {
            instance: { instanceId: "local-expose-1", pluginId: "local-expose", enabled: true },
            settings: { domain: "local.example.test" },
            engineSettings: {},
            logger: { warn: vi.fn() },
            auth: {},
            dataDir: "/tmp/daycare/plugins/local-expose-1",
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

        const instance = await plugin.create(api as never);
        await instance.load?.();
        if (!registeredProvider) {
            throw new Error("Expected provider registration");
        }
        const provider = registeredProvider as ExposeTunnelProvider;

        const created = await provider.createTunnel(3000, "public");
        await expect(provider.createTunnel(3001, "public")).rejects.toThrow(
            "Local Expose provider supports only one active expose endpoint at a time."
        );
        await provider.destroyTunnel(created.domain);
    });
});
