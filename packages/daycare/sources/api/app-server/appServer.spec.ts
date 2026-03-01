import { createHmac } from "node:crypto";
import { promises as fs } from "node:fs";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TaskActiveSummary } from "@/types";
import { configResolve } from "../../config/configResolve.js";
import { ConfigModule } from "../../engine/config/configModule.js";
import { ModuleRegistry } from "../../engine/modules/moduleRegistry.js";
import { JWT_SERVICE_WEBHOOK, jwtSign, jwtVerify } from "../../util/jwt.js";
import { APP_AUTH_SEED_KEY } from "./appJwtSecretResolve.js";
import { AppServer } from "./appServer.js";

type ActiveAppServer = {
    stop: () => Promise<void>;
};

const activeServers: ActiveAppServer[] = [];
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

type AppServerCreateTestOptions = {
    secret?: string;
    telegram?: {
        instanceId?: string;
        botToken: string;
    };
    webhookTrigger?: (webhookId: string, data?: unknown) => Promise<void>;
    appServerEnabled?: boolean;
    tasksListActive?: (userId: string) => Promise<TaskActiveSummary[]>;
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

async function appServerCreateForTests(options: AppServerCreateTestOptions = {}) {
    const entries = new Map<string, Record<string, unknown>>();
    if (options.secret) {
        entries.set(APP_AUTH_SEED_KEY, {
            seed: options.secret
        });
    }
    if (options.telegram?.botToken) {
        entries.set(options.telegram.instanceId ?? "telegram", {
            type: "token",
            token: options.telegram.botToken
        });
    }

    const port = await portAvailableResolve();
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-app-server-test-"));
    tmpDirs.push(tmpDir);

    const config = new ConfigModule(
        configResolve(
            {
                engine: {
                    dataDir: path.join(tmpDir, "data")
                },
                appServer: {
                    enabled: options.appServerEnabled ?? true,
                    host: "127.0.0.1",
                    port
                },
                ...(options.telegram
                    ? {
                          plugins: [
                              {
                                  instanceId: options.telegram.instanceId ?? "telegram",
                                  pluginId: "telegram",
                                  enabled: true
                              }
                          ]
                      }
                    : {})
            },
            path.join(tmpDir, "settings.json")
        )
    );

    const modules = new ModuleRegistry({
        onMessage: () => undefined
    });

    const auth = {
        getEntry: vi.fn(async (id: string) => entries.get(id) ?? null),
        getToken: vi.fn(async (id: string) => {
            const entry = entries.get(id);
            return typeof entry?.token === "string" ? entry.token : null;
        }),
        setEntry: vi.fn(async (id: string, entry: Record<string, unknown>) => {
            entries.set(id, entry);
        })
    };

    const appServer = new AppServer({
        config,
        auth: auth as never,
        commandRegistry: modules.commands,
        connectorRegistry: modules.connectors,
        toolResolver: modules.tools,
        webhooks: {
            trigger:
                options.webhookTrigger ??
                (async () => {
                    throw new Error("Webhook runtime unavailable.");
                })
        } as never,
        tasksListActive: async (ctx) => {
            if (!options.tasksListActive) {
                return [];
            }
            return options.tasksListActive(ctx.userId);
        },
        tokenStatsFetch: async () => [],
        documents: null
    });

    await appServer.start();
    activeServers.push({ stop: () => appServer.stop() });

    return {
        port,
        auth,
        commands: modules.commands,
        tools: modules.tools,
        connectors: modules.connectors
    };
}

afterEach(async () => {
    for (const server of activeServers.splice(0, activeServers.length)) {
        await server.stop();
    }
    for (const dir of tmpDirs.splice(0, tmpDirs.length)) {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

describe("AppServer auth endpoints", () => {
    it("returns welcome text on root route", async () => {
        const built = await appServerCreateForTests({ secret: "valid-secret-for-tests-1234567890" });

        const response = await fetch(`http://127.0.0.1:${built.port}/`);

        expect(response.status).toBe(200);
        expect(await response.text()).toBe("Welcome to Daycare App API!");
        expect(response.headers.get("content-type")).toContain("text/plain");
    });

    it("registers app command and app_auth_link tool when enabled", async () => {
        const built = await appServerCreateForTests({ secret: "valid-secret-for-tests-1234567890" });

        expect(built.commands.get("app")).not.toBeNull();
        expect(built.tools.listTools().some((tool) => tool.name === "app_auth_link")).toBe(true);
    });

    it("sends Telegram /app links as an inline button", async () => {
        const built = await appServerCreateForTests({ secret: "valid-secret-for-tests-1234567890" });
        const sendMessage = vi.fn(
            async (
                _targetId: string,
                _message: {
                    text: string;
                    replyToMessageId?: string;
                    buttons?: Array<{ text: string; url: string }>;
                }
            ) => undefined
        );
        built.connectors.register("telegram", {
            capabilities: { sendText: true },
            onMessage: () => () => undefined,
            sendMessage
        });

        const command = built.commands.get("app");
        expect(command).not.toBeNull();

        await command!.handler(
            "/app",
            { messageId: "42" },
            {
                type: "user",
                connector: "telegram",
                channelId: "123",
                userId: "123"
            }
        );

        expect(sendMessage).toHaveBeenCalledTimes(1);
        const sentCall = sendMessage.mock.calls[0];
        expect(sentCall).toBeTruthy();
        const sent = sentCall![1];
        expect(sent.text).toBe("Open your Daycare app using the button below.");
        expect(sent.text).not.toContain("http");
        expect(sent.replyToMessageId).toBe("42");
        expect(sent.buttons).toHaveLength(1);
        expect(sent.buttons?.[0]).toMatchObject({ text: "Open Daycare" });
        expect(sent.buttons?.[0]?.url).toContain("/auth#");
    });

    it("keeps app command and tool disabled when app server is disabled", async () => {
        const built = await appServerCreateForTests({
            secret: "valid-secret-for-tests-1234567890",
            appServerEnabled: false
        });

        expect(built.commands.get("app")).toBeNull();
        expect(built.tools.listTools().some((tool) => tool.name === "app_auth_link")).toBe(false);
    });

    it("routes POST /v1/webhooks/:token to webhook runtime", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const trigger = vi.fn(async () => undefined);
        const built = await appServerCreateForTests({
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

    it("returns 404 for invalid webhook token", async () => {
        const built = await appServerCreateForTests({
            secret: "valid-secret-for-tests-1234567890",
            webhookTrigger: vi.fn(async () => undefined)
        });

        const response = await fetch(`http://127.0.0.1:${built.port}/v1/webhooks/not-a-valid-token`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({})
        });

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({ ok: false, error: "Webhook trigger not found." });
    });

    it("returns ok for valid token", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await appServerCreateForTests({ secret });
        const token = await jwtSign({ userId: "user-1" }, secret, 3600);

        const response = await fetch(`http://127.0.0.1:${built.port}/auth/validate`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token })
        });

        const payload = (await response.json()) as {
            ok: boolean;
            userId?: string;
            token?: string;
            expiresAt?: number;
        };
        expect(payload).toMatchObject({ ok: true, userId: "user-1" });
        expect(typeof payload.token).toBe("string");
        expect(typeof payload.expiresAt).toBe("number");
    });

    it("returns token for valid Telegram WebApp initData", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const telegramToken = "telegram-token-1";
        const built = await appServerCreateForTests({
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
        };
        expect(payload.ok).toBe(true);
        expect(payload.userId).toBe("123");
        expect(typeof payload.token).toBe("string");
        expect(typeof payload.expiresAt).toBe("number");

        const verified = await jwtVerify(payload.token!, secret);
        expect(verified.userId).toBe("123");
    });

    it("returns 401 for unauthenticated unknown routes", async () => {
        const built = await appServerCreateForTests({ secret: "valid-secret-for-tests-1234567890" });

        const response = await fetch(`http://127.0.0.1:${built.port}/unknown`);

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({ ok: false, error: "Authentication required." });
    });

    it("returns 404 for authenticated unknown routes", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await appServerCreateForTests({ secret });
        const token = await jwtSign({ userId: "user-1" }, secret, 3600);

        const response = await fetch(`http://127.0.0.1:${built.port}/unknown`, {
            headers: { authorization: `Bearer ${token}` }
        });

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({ ok: false, error: "Not found." });
    });
});

describe("AppServer authenticated routes", () => {
    it("lists prompt files", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await appServerCreateForTests({ secret });
        const token = await jwtSign({ userId: "user-1" }, secret, 3600);

        const response = await fetch(`http://127.0.0.1:${built.port}/prompts`, {
            headers: { authorization: `Bearer ${token}` }
        });

        expect(response.status).toBe(200);
        const body = (await response.json()) as { ok: boolean; files: string[] };
        expect(body.ok).toBe(true);
        expect(body.files).toEqual(["SOUL.md", "USER.md", "AGENTS.md", "TOOLS.md"]);
    });

    it("lists active tasks", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await appServerCreateForTests({
            secret,
            tasksListActive: async () => [
                {
                    id: "daily-report",
                    title: "Daily report",
                    description: null,
                    createdAt: 10,
                    updatedAt: 20,
                    lastExecutedAt: 100,
                    triggers: {
                        cron: [
                            {
                                id: "cron-1",
                                schedule: "0 * * * *",
                                timezone: "UTC",
                                agentId: null,
                                lastExecutedAt: 100
                            }
                        ],
                        webhook: []
                    }
                }
            ]
        });
        const token = await jwtSign({ userId: "user-1" }, secret, 3600);

        const response = await fetch(`http://127.0.0.1:${built.port}/tasks/active`, {
            headers: { authorization: `Bearer ${token}` }
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            ok: true,
            tasks: [
                {
                    id: "daily-report",
                    lastExecutedAt: 100,
                    triggers: {
                        cron: [{ id: "cron-1" }]
                    }
                }
            ]
        });
    });
});
