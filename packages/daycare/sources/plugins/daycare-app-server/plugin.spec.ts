import { createHmac } from "node:crypto";
import { promises as fs } from "node:fs";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JWT_SERVICE_WEBHOOK, jwtSign, jwtVerify } from "../../util/jwt.js";
import { APP_AUTH_LINK_SERVICE, APP_AUTH_SESSION_EXPIRES_IN_SECONDS } from "./appAuthLinkTool.js";
import { plugin } from "./plugin.js";

const APP_AUTH_SEED_KEY = "seed";

type PluginInstance = Awaited<ReturnType<typeof plugin.create>>;

const activeInstances: PluginInstance[] = [];
const tmpDirs: string[] = [];

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

type PluginCreateTestOptions = {
    secret?: string;
    telegram?: {
        instanceId?: string;
        botToken: string;
    };
    webhookTrigger?: (webhookId: string, data?: unknown) => Promise<void>;
};

function telegramInitDataBuild(options: { botToken: string; userId: string; authDateSeconds: number }): string {
    const params = new URLSearchParams();
    params.set("auth_date", String(options.authDateSeconds));
    params.set("query_id", "AAEAAQ");
    params.set(
        "user",
        JSON.stringify({
            id: Number(options.userId),
            first_name: "Test"
        })
    );

    const dataCheckString = Array.from(params.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");
    const secretKey = createHmac("sha256", "WebAppData").update(options.botToken).digest();
    const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    params.set("hash", hash);
    return params.toString();
}

async function pluginCreateForTests(options?: PluginCreateTestOptions) {
    const entries = new Map<string, Record<string, unknown>>();
    if (options?.secret) {
        entries.set(APP_AUTH_SEED_KEY, {
            seed: options.secret
        });
    }
    if (options?.telegram?.botToken) {
        entries.set(options.telegram.instanceId ?? "telegram", {
            type: "token",
            token: options.telegram.botToken
        });
    }

    const port = await portAvailableResolve();
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-app-server-test-"));
    tmpDirs.push(tmpDir);
    const usersDir = path.join(tmpDir, "users");

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
        engineSettings: options?.telegram
            ? {
                  plugins: [
                      {
                          instanceId: options.telegram.instanceId ?? "telegram",
                          pluginId: "telegram",
                          enabled: true
                      }
                  ]
              }
            : {},
        logger: {
            info: vi.fn(),
            warn: vi.fn()
        },
        auth: {
            getEntry: vi.fn(async (id: string) => entries.get(id) ?? null),
            getToken: vi.fn(async (id: string) => {
                const entry = entries.get(id);
                return typeof entry?.token === "string" ? entry.token : null;
            }),
            setEntry: vi.fn(async (id: string, entry: Record<string, unknown>) => {
                entries.set(id, entry);
            })
        },
        dataDir: path.join(tmpDir, "data"),
        tmpDir: path.join(tmpDir, "tmp"),
        usersDir,
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
        webhooks: {
            trigger:
                options?.webhookTrigger ??
                (async () => {
                    throw new Error("Webhook runtime unavailable.");
                })
        },
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
        port,
        usersDir
    };
}

afterEach(async () => {
    for (const instance of activeInstances.splice(0, activeInstances.length)) {
        await instance.unload?.();
    }
    for (const dir of tmpDirs.splice(0, tmpDirs.length)) {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

describe("daycare-app-server plugin auth endpoints", () => {
    it("returns welcome text on root route", async () => {
        const built = await pluginCreateForTests({ secret: "valid-secret-for-tests-1234567890" });

        const response = await fetch(`http://127.0.0.1:${built.port}/`);

        expect(response.status).toBe(200);
        expect(await response.text()).toBe("Welcome to Daycare App API!");
        expect(response.headers.get("content-type")).toContain("text/plain");
    });

    it("routes POST /v1/webhooks/:token to webhook runtime", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const trigger = vi.fn(async () => undefined);
        const built = await pluginCreateForTests({
            secret,
            webhookTrigger: trigger
        });
        const webhookToken = await jwtSign({ userId: "hook-1" }, secret, 3600, {
            service: JWT_SERVICE_WEBHOOK
        });

        const response = await fetch(`http://127.0.0.1:${built.port}/v1/webhooks/${webhookToken}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ event: "deploy" })
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ ok: true });
        expect(trigger).toHaveBeenCalledWith("hook-1", { event: "deploy" });
    });

    it("returns 404 when webhook trigger does not exist", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await pluginCreateForTests({
            secret,
            webhookTrigger: async () => {
                throw new Error("Webhook trigger not found: missing");
            }
        });
        const webhookToken = await jwtSign({ userId: "missing" }, secret, 3600, {
            service: JWT_SERVICE_WEBHOOK
        });

        const response = await fetch(`http://127.0.0.1:${built.port}/v1/webhooks/${webhookToken}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({})
        });

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
            ok: false,
            error: "Webhook trigger not found: missing"
        });
    });

    it("returns 500 when webhook execution fails", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await pluginCreateForTests({
            secret,
            webhookTrigger: async () => {
                throw new Error("Webhook execution failed");
            }
        });
        const webhookToken = await jwtSign({ userId: "hook-err" }, secret, 3600, {
            service: JWT_SERVICE_WEBHOOK
        });

        const response = await fetch(`http://127.0.0.1:${built.port}/v1/webhooks/${webhookToken}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({})
        });

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({
            ok: false,
            error: "Webhook execution failed"
        });
    });

    it("returns 503 when webhook runtime is unavailable", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await pluginCreateForTests({ secret });
        const webhookToken = await jwtSign({ userId: "hook-1" }, secret, 3600, {
            service: JWT_SERVICE_WEBHOOK
        });

        const response = await fetch(`http://127.0.0.1:${built.port}/v1/webhooks/${webhookToken}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({})
        });

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toEqual({
            ok: false,
            error: "Webhook runtime unavailable."
        });
    });

    it("returns 404 for invalid webhook token", async () => {
        const trigger = vi.fn(async () => undefined);
        const built = await pluginCreateForTests({
            secret: "valid-secret-for-tests-1234567890",
            webhookTrigger: trigger
        });

        const response = await fetch(`http://127.0.0.1:${built.port}/v1/webhooks/not-a-valid-token`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({})
        });

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
            ok: false,
            error: "Webhook trigger not found."
        });
        expect(trigger).not.toHaveBeenCalled();
    });

    it("returns ok for valid session token", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await pluginCreateForTests({ secret });
        const token = await jwtSign({ userId: "user-1" }, secret, 3600);

        const response = await fetch(`http://127.0.0.1:${built.port}/auth/validate`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token })
        });

        await expect(response.json()).resolves.toEqual({
            ok: true,
            userId: "user-1",
            token,
            expiresAt: expect.any(Number)
        });
    });

    it("exchanges valid link token into a long-lived session token", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await pluginCreateForTests({ secret });
        const linkToken = await jwtSign({ userId: "user-1" }, secret, 3600, {
            service: APP_AUTH_LINK_SERVICE
        });

        const response = await fetch(`http://127.0.0.1:${built.port}/auth/validate`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token: linkToken })
        });

        const payload = (await response.json()) as {
            ok: boolean;
            userId?: string;
            token?: string;
            expiresAt?: number;
        };
        expect(payload.ok).toBe(true);
        expect(payload.userId).toBe("user-1");
        expect(typeof payload.token).toBe("string");
        expect(payload.token).not.toBe(linkToken);
        expect(typeof payload.expiresAt).toBe("number");
        const verified = await jwtVerify(payload.token!, secret);
        expect(verified.userId).toBe("user-1");
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

    it("returns token for valid Telegram WebApp initData", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const telegramToken = "telegram-token-1";
        const built = await pluginCreateForTests({
            secret,
            telegram: {
                botToken: telegramToken
            }
        });
        const initData = telegramInitDataBuild({
            botToken: telegramToken,
            userId: "123",
            authDateSeconds: Math.floor(Date.now() / 1000) - 10
        });

        const response = await fetch(`http://127.0.0.1:${built.port}/auth/telegram`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                initData
            })
        });

        const payload = (await response.json()) as {
            ok: boolean;
            userId?: string;
            token?: string;
            expiresAt?: number;
            error?: string;
        };
        expect(payload.ok).toBe(true);
        expect(payload.userId).toBe("123");
        expect(typeof payload.token).toBe("string");
        expect(typeof payload.expiresAt).toBe("number");

        const verified = await jwtVerify(payload.token!, secret);
        expect(verified.userId).toBe("123");
        expect(verified.exp - verified.iat).toBe(APP_AUTH_SESSION_EXPIRES_IN_SECONDS);
    });

    it("returns error for invalid Telegram WebApp initData", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await pluginCreateForTests({
            secret,
            telegram: {
                botToken: "telegram-token-1"
            }
        });
        const initData = telegramInitDataBuild({
            botToken: "different-token",
            userId: "123",
            authDateSeconds: Math.floor(Date.now() / 1000) - 10
        });

        const response = await fetch(`http://127.0.0.1:${built.port}/auth/telegram`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                initData
            })
        });

        const payload = (await response.json()) as { ok: boolean; error?: string };
        expect(payload.ok).toBe(false);
        expect(typeof payload.error).toBe("string");
    });

    it("returns 401 for unauthenticated unknown routes", async () => {
        const built = await pluginCreateForTests({ secret: "valid-secret-for-tests-1234567890" });

        const response = await fetch(`http://127.0.0.1:${built.port}/unknown`);

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({ ok: false, error: "Authentication required." });
    });

    it("returns 404 for authenticated unknown routes", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await pluginCreateForTests({ secret });
        const token = await jwtSign({ userId: "user-1" }, secret, 3600);

        const response = await fetch(`http://127.0.0.1:${built.port}/unknown`, {
            headers: { authorization: `Bearer ${token}` }
        });

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({ ok: false, error: "Not found." });
    });
});

describe("daycare-app-server plugin prompts endpoints", () => {
    it("returns 401 for unauthenticated prompts request", async () => {
        const built = await pluginCreateForTests({ secret: "valid-secret-for-tests-1234567890" });

        const response = await fetch(`http://127.0.0.1:${built.port}/prompts`);

        expect(response.status).toBe(401);
    });

    it("lists prompt files", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await pluginCreateForTests({ secret });
        const token = await jwtSign({ userId: "user-1" }, secret, 3600);

        const response = await fetch(`http://127.0.0.1:${built.port}/prompts`, {
            headers: { authorization: `Bearer ${token}` }
        });

        expect(response.status).toBe(200);
        const body = (await response.json()) as { ok: boolean; files: string[] };
        expect(body.ok).toBe(true);
        expect(body.files).toEqual(["SOUL.md", "USER.md", "AGENTS.md", "TOOLS.md"]);
    });

    it("reads a prompt file falling back to bundled default", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await pluginCreateForTests({ secret });
        const token = await jwtSign({ userId: "user-1" }, secret, 3600);

        const response = await fetch(`http://127.0.0.1:${built.port}/prompts/SOUL.md`, {
            headers: { authorization: `Bearer ${token}` }
        });

        expect(response.status).toBe(200);
        const body = (await response.json()) as { ok: boolean; filename: string; content: string };
        expect(body.ok).toBe(true);
        expect(body.filename).toBe("SOUL.md");
        expect(body.content).toContain("SOUL.md");
    });

    it("writes and reads back a prompt file", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await pluginCreateForTests({ secret });
        const token = await jwtSign({ userId: "user-1" }, secret, 3600);

        const writeResponse = await fetch(`http://127.0.0.1:${built.port}/prompts/USER.md`, {
            method: "PUT",
            headers: {
                authorization: `Bearer ${token}`,
                "content-type": "application/json"
            },
            body: JSON.stringify({ content: "# Custom User\n\n- Name: Test" })
        });

        expect(writeResponse.status).toBe(200);
        await expect(writeResponse.json()).resolves.toEqual({ ok: true, filename: "USER.md" });

        const readResponse = await fetch(`http://127.0.0.1:${built.port}/prompts/USER.md`, {
            headers: { authorization: `Bearer ${token}` }
        });

        const body = (await readResponse.json()) as { ok: boolean; filename: string; content: string };
        expect(body.ok).toBe(true);
        expect(body.content).toBe("# Custom User\n\n- Name: Test");
    });

    it("rejects unknown prompt filenames", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await pluginCreateForTests({ secret });
        const token = await jwtSign({ userId: "user-1" }, secret, 3600);

        const response = await fetch(`http://127.0.0.1:${built.port}/prompts/EVIL.md`, {
            headers: { authorization: `Bearer ${token}` }
        });

        expect(response.status).toBe(400);
        const body = (await response.json()) as { ok: boolean; error: string };
        expect(body.ok).toBe(false);
        expect(body.error).toContain("Unknown prompt file");
    });
});
