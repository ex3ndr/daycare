import { createServer } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jwtSign } from "../../util/jwt.js";
import { plugin } from "./plugin.js";

const APP_AUTH_SECRET_KEY = "app-auth.jwtSecret";

type PluginInstance = Awaited<ReturnType<typeof plugin.create>>;

const activeInstances: PluginInstance[] = [];

async function portAvailableResolve(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            if (!address || typeof address === "string") {
                server.close();
                reject(new Error("Failed to allocate random test port."));
                return;
            }
            const port = address.port;
            server.close(() => resolve(port));
        });
        server.on("error", reject);
    });
}

async function pluginCreateForTests(options?: { secret?: string }) {
    const entries = new Map<string, Record<string, unknown>>();
    if (options?.secret) {
        entries.set(APP_AUTH_SECRET_KEY, {
            type: "token",
            token: options.secret,
            secret: options.secret
        });
    }

    const port = await portAvailableResolve();

    const api = {
        instance: {
            instanceId: "daycare-app-server",
            pluginId: "daycare-app-server",
            enabled: true
        },
        settings: {
            host: "127.0.0.1",
            port
        },
        engineSettings: {},
        logger: {
            info: vi.fn(),
            warn: vi.fn()
        },
        auth: {
            getEntry: vi.fn(async (id: string) => entries.get(id) ?? null),
            setEntry: vi.fn(async (id: string, entry: Record<string, unknown>) => {
                entries.set(id, entry);
            })
        },
        dataDir: "/tmp/daycare-test/daycare-app-server",
        tmpDir: "/tmp/daycare-test/tmp",
        registrar: {
            registerTool: vi.fn(),
            unregisterTool: vi.fn(),
            registerCommand: vi.fn(),
            unregisterCommand: vi.fn(),
            sendMessage: vi.fn(async () => undefined)
        },
        exposes: {
            registerProvider: vi.fn(async () => undefined),
            unregisterProvider: vi.fn(async () => undefined),
            listProviders: () => []
        },
        fileStore: {},
        inference: {
            complete: async () => {
                throw new Error("Inference unavailable in tests");
            }
        },
        processes: {},
        mode: "runtime" as const,
        events: {
            emit: vi.fn()
        }
    };

    const instance = await plugin.create(api as never);
    await instance.load?.();
    activeInstances.push(instance);

    return {
        api,
        entries,
        port
    };
}

afterEach(async () => {
    for (const instance of activeInstances.splice(0, activeInstances.length)) {
        await instance.unload?.();
    }
});

describe("daycare-app-server plugin auth endpoints", () => {
    it("returns ok for valid token", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await pluginCreateForTests({ secret });
        const token = await jwtSign({ userId: "user-1" }, secret, 3600);

        const response = await fetch(`http://127.0.0.1:${built.port}/auth/validate`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token })
        });

        await expect(response.json()).resolves.toEqual({ ok: true, userId: "user-1" });
    });

    it("returns error for expired token", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await pluginCreateForTests({ secret });
        const token = await jwtSign({ userId: "user-1" }, secret, -10);

        const response = await fetch(`http://127.0.0.1:${built.port}/auth/validate`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token })
        });

        const payload = (await response.json()) as { ok: boolean; error?: string };
        expect(payload.ok).toBe(false);
        expect(typeof payload.error).toBe("string");
    });

    it("returns error for malformed token", async () => {
        const built = await pluginCreateForTests({ secret: "valid-secret-for-tests-1234567890" });

        const response = await fetch(`http://127.0.0.1:${built.port}/auth/validate`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token: "not-a-jwt" })
        });

        const payload = (await response.json()) as { ok: boolean; error?: string };
        expect(payload.ok).toBe(false);
        expect(typeof payload.error).toBe("string");
    });

    it("returns error for missing token", async () => {
        const built = await pluginCreateForTests({ secret: "valid-secret-for-tests-1234567890" });

        const response = await fetch(`http://127.0.0.1:${built.port}/auth/validate`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({})
        });

        await expect(response.json()).resolves.toEqual({ ok: false, error: "Token is required." });
    });
});
