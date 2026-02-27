import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { configResolve } from "../../config/configResolve.js";
import type { Storage } from "../../storage/storage.js";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { ConfigModule } from "../config/configModule.js";
import { EngineEventBus } from "../ipc/events.js";
import { Exposes } from "./exposes.js";
import type { ExposeTunnelProvider } from "./exposeTypes.js";

describe("Exposes", () => {
    it("supports create/update/remove/list lifecycle", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-exposes-"));
        const storage = await storageOpenTest();
        try {
            const exposes = createExposes(dir, storage);
            const provider = providerBuild({
                instanceId: "provider-a",
                domain: "a.example.com",
                domains: ["ep1.a.example.com"]
            });

            await exposes.registerProvider(provider);
            await exposes.start();

            const created = await exposes.create(
                {
                    target: { type: "port", port: 3000 },
                    mode: "public",
                    authenticated: true
                },
                "user-1"
            );

            expect(created.endpoint.provider).toBe("provider-a");
            expect(created.endpoint.domain).toBe("ep1.a.example.com");
            expect(created.endpoint.auth).not.toBeNull();
            expect(created.password).toBeTruthy();

            const listedAfterCreate = await exposes.list();
            expect(listedAfterCreate).toHaveLength(1);

            const updatedDisabled = await exposes.update(created.endpoint.id, {
                authenticated: false
            });
            expect(updatedDisabled.endpoint.auth).toBeNull();
            expect(updatedDisabled.password).toBeUndefined();

            const updatedEnabled = await exposes.update(created.endpoint.id, {
                authenticated: true
            });
            expect(updatedEnabled.endpoint.auth).not.toBeNull();
            expect(updatedEnabled.password).toBeTruthy();

            const persisted = await exposeEndpointRowRead(storage, created.endpoint.id);
            expect(persisted.auth?.passwordHash).toBeTruthy();
            expect(persisted.auth?.passwordHash).not.toBe(updatedEnabled.password);

            await exposes.remove(created.endpoint.id);
            expect(await exposes.list()).toEqual([]);
            expect(provider.destroyTunnel).toHaveBeenCalledWith("ep1.a.example.com");

            await exposes.stop();
        } finally {
            storage.db.close();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("selects providers and errors when ambiguous", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-exposes-"));
        const storage = await storageOpenTest();
        try {
            const exposes = createExposes(dir, storage);
            await exposes.start();

            await expect(
                exposes.create(
                    {
                        target: { type: "port", port: 3001 },
                        mode: "public",
                        authenticated: false
                    },
                    "user-1"
                )
            ).rejects.toThrow("No expose tunnel providers are configured");

            const providerA = providerBuild({
                instanceId: "provider-a",
                domain: "a.example.com",
                domains: ["a-1.example.com"]
            });
            await exposes.registerProvider(providerA);

            const created = await exposes.create(
                {
                    target: { type: "port", port: 3002 },
                    mode: "public",
                    authenticated: false
                },
                "user-1"
            );
            expect(created.endpoint.provider).toBe("provider-a");

            const providerB = providerBuild({
                instanceId: "provider-b",
                domain: "b.example.com",
                domains: ["b-1.example.com"]
            });
            await exposes.registerProvider(providerB);

            await expect(
                exposes.create(
                    {
                        target: { type: "port", port: 3003 },
                        mode: "public",
                        authenticated: false
                    },
                    "user-1"
                )
            ).rejects.toThrow("Specify provider");

            await expect(
                exposes.create(
                    {
                        target: { type: "port", port: 3004 },
                        provider: "missing-provider",
                        mode: "public",
                        authenticated: false
                    },
                    "user-1"
                )
            ).rejects.toThrow("Expose provider not found");

            await exposes.stop();
        } finally {
            storage.db.close();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("restores endpoints from disk on restart", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-exposes-"));
        const storage = await storageOpenTest();
        try {
            const first = createExposes(dir, storage);
            const provider = providerBuild({
                instanceId: "provider-a",
                domain: "a.example.com",
                domains: ["created.a.example.com", "restored.a.example.com"]
            });

            await first.registerProvider(provider);
            await first.start();
            const created = await first.create(
                {
                    target: { type: "port", port: 3000 },
                    mode: "public",
                    authenticated: false
                },
                "user-1"
            );
            await first.stop();

            const second = createExposes(dir, storage);
            await second.registerProvider(provider);
            await second.start();

            const list = await second.list();
            expect(list).toHaveLength(1);
            expect(list[0]?.id).toBe(created.endpoint.id);
            expect(list[0]?.domain).toBe("restored.a.example.com");
            expect(provider.createTunnel).toHaveBeenCalledTimes(2);

            await second.stop();
        } finally {
            storage.db.close();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("updates endpoints even when provider is unavailable", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-exposes-"));
        const storage = await storageOpenTest();
        try {
            const first = createExposes(dir, storage);
            const provider = providerBuild({
                instanceId: "provider-a",
                domain: "a.example.com",
                domains: ["created.a.example.com"]
            });

            await first.registerProvider(provider);
            await first.start();
            const created = await first.create(
                {
                    target: { type: "port", port: 3000 },
                    mode: "public",
                    authenticated: false
                },
                "user-1"
            );
            await first.stop();

            const second = createExposes(dir, storage);
            await second.start();

            const updated = await second.update(created.endpoint.id, {
                authenticated: true
            });
            expect(updated.endpoint.auth).not.toBeNull();
            expect(updated.password).toBeTruthy();

            await second.stop();
        } finally {
            storage.db.close();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("rolls back tunnels when domain normalization fails", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-exposes-"));
        const storage = await storageOpenTest();
        try {
            const expose = createExposes(dir, storage);
            const createFailProvider = providerBuild({
                instanceId: "provider-a",
                domain: "a.example.com",
                domains: ["https://broken.example.com"]
            });
            await expose.registerProvider(createFailProvider);
            await expose.start();

            await expect(
                expose.create(
                    {
                        target: { type: "port", port: 3000 },
                        mode: "public",
                        authenticated: false
                    },
                    "user-1"
                )
            ).rejects.toThrow("Invalid expose domain");
            expect(createFailProvider.destroyTunnel).toHaveBeenCalledWith("https://broken.example.com");
            await expose.stop();

            const first = createExposes(dir, storage);
            const validProvider = providerBuild({
                instanceId: "provider-a",
                domain: "a.example.com",
                domains: ["created.a.example.com"]
            });
            await first.registerProvider(validProvider);
            await first.start();
            await first.create(
                {
                    target: { type: "port", port: 3001 },
                    mode: "public",
                    authenticated: false
                },
                "user-1"
            );
            await first.stop();

            const second = createExposes(dir, storage);
            const restoreFailProvider = providerBuild({
                instanceId: "provider-a",
                domain: "a.example.com",
                domains: ["https://broken-restore.example.com"]
            });
            await second.registerProvider(restoreFailProvider);
            await expect(second.start()).rejects.toThrow("Invalid expose domain");
            expect(restoreFailProvider.destroyTunnel).toHaveBeenCalledWith("https://broken-restore.example.com");
            await second.stop();
        } finally {
            storage.db.close();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("keeps the reactivated domain when update triggers tunnel activation", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-exposes-"));
        const storage = await storageOpenTest();
        try {
            const exposes = createExposes(dir, storage);
            const provider = providerBuild({
                instanceId: "provider-a",
                domain: "a.example.com",
                domains: ["created.a.example.com", "reactivated.a.example.com"]
            });

            await exposes.registerProvider(provider);
            await exposes.start();

            const created = await exposes.create(
                {
                    target: { type: "port", port: 3000 },
                    mode: "public",
                    authenticated: false
                },
                "user-1"
            );

            const internal = exposes as unknown as {
                endpointDeactivate: (endpointId: string) => Promise<void>;
            };
            await internal.endpointDeactivate(created.endpoint.id);

            const updated = await exposes.update(created.endpoint.id, {
                authenticated: true
            });
            expect(updated.endpoint.domain).toBe("reactivated.a.example.com");

            const listed = await exposes.list();
            expect(listed[0]?.domain).toBe("reactivated.a.example.com");

            const persisted = await exposeEndpointRowRead(storage, created.endpoint.id);
            expect(persisted.domain).toBe("reactivated.a.example.com");

            await exposes.stop();
        } finally {
            storage.db.close();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("applies new auth hash when update reactivates a dormant endpoint", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-exposes-"));
        const storage = await storageOpenTest();
        try {
            const exposes = createExposes(dir, storage);
            const provider = providerBuild({
                instanceId: "provider-a",
                domain: "a.example.com",
                domains: ["created.a.example.com", "reactivated.a.example.com"]
            });

            await exposes.registerProvider(provider);
            await exposes.start();

            const created = await exposes.create(
                {
                    target: { type: "port", port: 3000 },
                    mode: "public",
                    authenticated: false
                },
                "user-1"
            );

            const internal = exposes as unknown as {
                endpointDeactivate: (endpointId: string) => Promise<void>;
                proxy: { addRoute: (domain: string, target: unknown, passwordHash?: string) => void };
            };
            await internal.endpointDeactivate(created.endpoint.id);
            const addRouteSpy = vi.spyOn(internal.proxy, "addRoute");

            const updated = await exposes.update(created.endpoint.id, {
                authenticated: true
            });
            expect(updated.endpoint.auth).not.toBeNull();
            expect(addRouteSpy).toHaveBeenCalledTimes(1);
            expect(addRouteSpy.mock.calls[0]?.[2]).toBe(updated.endpoint.auth?.passwordHash);

            await exposes.stop();
        } finally {
            storage.db.close();
            await rm(dir, { recursive: true, force: true });
        }
    });
});

function createExposes(rootDir: string, storage: Storage): Exposes {
    const config = configResolve(
        {
            engine: { dataDir: path.join(rootDir, ".daycare") }
        },
        path.join(rootDir, "settings.json")
    );
    return new Exposes({
        config: new ConfigModule(config),
        eventBus: new EngineEventBus(),
        exposeEndpoints: storage.exposeEndpoints
    });
}

function providerBuild(options: { instanceId: string; domain: string; domains: string[] }): ExposeTunnelProvider {
    const pendingDomains = [...options.domains];
    const createTunnel = vi.fn<[number, "public" | "local-network", string], Promise<{ domain: string }>>(async () => {
        const domain = pendingDomains.shift();
        if (!domain) {
            throw new Error("No pending domain configured for test provider");
        }
        return { domain };
    });
    const destroyTunnel = vi.fn<[string], Promise<void>>(async () => undefined);
    return {
        instanceId: options.instanceId,
        domain: options.domain,
        capabilities: {
            public: true,
            localNetwork: true
        },
        createTunnel,
        destroyTunnel
    };
}

async function exposeEndpointRowRead(
    storage: Storage,
    endpointId: string
): Promise<{ domain: string; auth: { passwordHash: string } | null }> {
    const row = (await storage.db
        .prepare("SELECT domain, auth FROM expose_endpoints WHERE id = ? LIMIT 1")
        .get(endpointId)) as { domain?: string; auth?: string | null } | undefined;
    return {
        domain: row?.domain ?? "",
        auth: row?.auth ? (JSON.parse(row.auth) as { passwordHash: string }) : null
    };
}
