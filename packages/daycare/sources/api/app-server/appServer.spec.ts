import { createHmac } from "node:crypto";
import { promises as fs } from "node:fs";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TaskActiveSummary } from "@/types";
import { configResolve } from "../../config/configResolve.js";
import { contextForUser } from "../../engine/agents/context.js";
import { agentPathConnector } from "../../engine/agents/ops/agentPathBuild.js";
import { ConfigModule } from "../../engine/config/configModule.js";
import { ModuleRegistry } from "../../engine/modules/moduleRegistry.js";
import { Secrets } from "../../engine/secrets/secrets.js";
import type { Storage } from "../../storage/storage.js";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { userConnectorKeyCreate } from "../../storage/userConnectorKeyCreate.js";
import { JWT_SERVICE_WEBHOOK, jwtSign, jwtVerify } from "../../utils/jwt.js";
import type { RouteAgentCallbacks, RouteTaskCallbacks } from "../routes/routeTypes.js";
import { APP_AUTH_SEED_KEY } from "./appJwtSecretResolve.js";
import { AppServer } from "./appServer.js";

const sendMailMock = vi.hoisted(() => vi.fn(async (_message: unknown) => undefined));

vi.mock("nodemailer", () => {
    return {
        default: {
            createTransport: vi.fn(() => ({
                sendMail: sendMailMock
            }))
        }
    };
});

type ActiveAppServer = {
    stop: () => Promise<void>;
};

const activeServers: ActiveAppServer[] = [];
const activeStorages: Storage[] = [];
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
    emailAuth?: {
        smtpUrl: string;
        from: string;
        replyTo?: string;
    };
    webhookTrigger?: (webhookId: string, data?: unknown) => Promise<void>;
    appServerEnabled?: boolean;
    agentCallbacks?: RouteAgentCallbacks | null;
    tasksListActive?: (userId: string) => Promise<TaskActiveSummary[]>;
    taskCallbacks?: RouteTaskCallbacks;
};

function taskCallbacksBuild(overrides: Partial<RouteTaskCallbacks> = {}): RouteTaskCallbacks {
    return {
        tasksCreate: async () => {
            throw new Error("not implemented");
        },
        tasksRead: async () => null,
        tasksUpdate: async () => null,
        tasksDelete: async () => false,
        tasksRun: async () => ({ queued: true }),
        cronTriggerAdd: async () => {
            throw new Error("not implemented");
        },
        cronTriggerRemove: async () => 0,
        webhookTriggerAdd: async () => {
            throw new Error("not implemented");
        },
        webhookTriggerRemove: async () => 0,
        ...overrides
    };
}

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
                    port,
                    ...(options.emailAuth
                        ? {
                              appEndpoint: "https://app.example.com",
                              serverEndpoint: "https://api.example.com"
                          }
                        : {})
                },
                ...(options.emailAuth
                    ? {
                          email: options.emailAuth
                      }
                    : {}),
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
    const storage = await storageOpenTest();
    activeStorages.push(storage);
    const secrets = new Secrets({
        usersDir: config.current.usersDir,
        observationLog: storage.observationLog
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
        db: storage.db,
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
        users: storage.users,
        workspaceMembers: storage.workspaceMembers,
        agentCallbacks: options.agentCallbacks ?? null,
        eventBus: null,
        skills: null,
        tasksListActive: async (ctx) => {
            if (!options.tasksListActive) {
                return [];
            }
            return options.tasksListActive(ctx.userId);
        },
        tasksListAll: async () => ({ tasks: [], triggers: { cron: [], webhook: [] } }),
        taskCallbacks: options.taskCallbacks ?? null,
        tokenStatsFetch: async () => [],
        documents: null,
        fragments: null,
        keyValues: storage.keyValues,
        observationLog: storage.observationLog,
        secrets,
        connectorTargetResolve: async (target) => {
            const segments = target.split("/").filter((segment) => segment.length > 0);
            const userId = segments[0] ?? "";
            const connector = segments[1] ?? "";
            if (!userId || !connector) {
                return null;
            }
            return { connector, targetId: userId };
        }
    });

    await appServer.start();
    activeServers.push({ stop: () => appServer.stop() });

    return {
        port,
        auth,
        storage,
        secrets,
        commands: modules.commands,
        tools: modules.tools,
        connectors: modules.connectors
    };
}

afterEach(async () => {
    sendMailMock.mockClear();
    for (const server of activeServers.splice(0, activeServers.length)) {
        await server.stop();
    }
    for (const storage of activeStorages.splice(0, activeStorages.length)) {
        await storage.connection.close();
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
                    text: string | null;
                    replyToMessageId?: string;
                    buttons?: Array<{ type: "url" | "callback"; text: string; url?: string; callback?: string }>;
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

        await command!.handler("/app", { messageId: "42" }, agentPathConnector("123", "telegram"));

        expect(sendMessage).toHaveBeenCalledTimes(1);
        const sentCall = sendMessage.mock.calls[0];
        expect(sentCall).toBeTruthy();
        const sent = sentCall![1];
        expect(sent.text).toBe("Open your Daycare app using the button below.");
        expect(sent.text).not.toContain("http");
        expect(sent.replyToMessageId).toBe("42");
        expect(sent.buttons).toHaveLength(1);
        expect(sent.buttons?.[0]).toMatchObject({ type: "url", text: "Open Daycare" });
        expect(sent.buttons?.[0]?.type === "url" ? sent.buttons[0].url : "").toContain("/verify#");
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
        expect(typeof payload.token).toBe("string");
        expect(typeof payload.expiresAt).toBe("number");
        const mappedUser = await built.storage.resolveUserByConnectorKey(userConnectorKeyCreate("telegram", "123"));
        expect(payload.userId).toBe(mappedUser.id);

        const verified = await jwtVerify(payload.token!, secret);
        expect(verified.userId).toBe(mappedUser.id);
    });

    it("sends and verifies email magic links through Better Auth", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await appServerCreateForTests({
            secret,
            emailAuth: {
                smtpUrl: "smtp://mailer.example.com",
                from: "Daycare <no-reply@example.com>"
            }
        });

        const requestResponse = await fetch(`http://127.0.0.1:${built.port}/auth/email/request`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: "person@example.com" })
        });

        await expect(requestResponse.json()).resolves.toEqual({ ok: true });
        expect(sendMailMock).toHaveBeenCalledTimes(1);
        const sentMessage = sendMailMock.mock.calls[0]?.[0] as { text?: string } | undefined;
        const emailToken = appServerEmailTokenExtract(sentMessage?.text ?? "");

        const verifyResponse = await fetch(`http://127.0.0.1:${built.port}/auth/email/verify`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token: emailToken })
        });

        const payload = (await verifyResponse.json()) as {
            ok: boolean;
            userId?: string;
            token?: string;
        };
        expect(payload.ok).toBe(true);
        expect(typeof payload.userId).toBe("string");
        expect(typeof payload.token).toBe("string");
        const mappedUser = await built.storage.resolveUserByConnectorKey(
            userConnectorKeyCreate("email", "person@example.com")
        );
        expect(payload.userId).toBe(mappedUser.id);

        const verified = await jwtVerify(payload.token!, secret);
        expect(verified.userId).toBe(mappedUser.id);
    });

    it("connects an email to the authenticated user through a verification link", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await appServerCreateForTests({
            secret,
            emailAuth: {
                smtpUrl: "smtp://mailer.example.com",
                from: "Daycare <no-reply@example.com>"
            }
        });
        const user = await built.storage.users.create({});
        const token = await jwtSign({ userId: user.id }, secret, 3600);

        const requestResponse = await fetch(`http://127.0.0.1:${built.port}/profile/email/connect/request`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${token}`,
                "content-type": "application/json"
            },
            body: JSON.stringify({ email: "person@example.com" })
        });

        await expect(requestResponse.json()).resolves.toEqual({ ok: true });
        expect(sendMailMock).toHaveBeenCalledTimes(1);
        const sentMessage = sendMailMock.mock.calls[0]?.[0] as { text?: string } | undefined;
        const connectToken = appServerEmailTokenExtract(sentMessage?.text ?? "");

        const verifyResponse = await fetch(`http://127.0.0.1:${built.port}/auth/email/connect/verify`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token: connectToken })
        });

        await expect(verifyResponse.json()).resolves.toEqual({
            ok: true,
            userId: user.id,
            email: "person@example.com"
        });

        const reloaded = await built.storage.users.findById(user.id);
        expect(reloaded?.connectorKeys.map((entry) => entry.connectorKey)).toContain(
            userConnectorKeyCreate("email", "person@example.com")
        );
    });

    it("creates invites, accepts them, lists joined workspaces, and revokes member access after kick", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await appServerCreateForTests({ secret });
        const owner = (await built.storage.users.findMany()).find(
            (user) => !user.isWorkspace && user.workspaceOwnerId === null
        );
        if (!owner) {
            throw new Error("Expected seeded owner user.");
        }

        const workspace = await built.storage.users.create({
            id: "workspace-1",
            nametag: "product-ops",
            firstName: "Product",
            lastName: "Ops",
            isWorkspace: true,
            workspaceOwnerId: owner.id,
            createdAt: 10,
            updatedAt: 10
        });
        const member = await built.storage.users.create({
            id: "member-1",
            nametag: "member-1",
            createdAt: 20,
            updatedAt: 20
        });

        const ownerToken = await jwtSign({ userId: owner.id }, secret, 3600);
        const memberToken = await jwtSign({ userId: member.id }, secret, 3600);

        const inviteResponse = await fetch(
            `http://127.0.0.1:${built.port}/workspaces/${workspace.nametag}/invite/create`,
            {
                method: "POST",
                headers: {
                    authorization: `Bearer ${ownerToken}`,
                    "content-type": "application/json",
                    origin: "https://app.example.com",
                    host: "api.example.com",
                    "x-forwarded-proto": "https"
                },
                body: JSON.stringify({})
            }
        );
        const invitePayload = (await inviteResponse.json()) as {
            ok: boolean;
            token?: string;
            url?: string;
        };
        expect(invitePayload.ok).toBe(true);
        expect(invitePayload.url).toContain("https://app.example.com/invite#");

        const acceptResponse = await fetch(`http://127.0.0.1:${built.port}/invite/accept`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${memberToken}`,
                "content-type": "application/json"
            },
            body: JSON.stringify({ token: invitePayload.token })
        });
        await expect(acceptResponse.json()).resolves.toEqual({
            ok: true,
            workspaceId: workspace.id
        });
        await expect(built.storage.workspaceMembers.isMember(workspace.id, member.id)).resolves.toBe(true);

        const workspacesResponse = await fetch(`http://127.0.0.1:${built.port}/workspaces`, {
            headers: {
                authorization: `Bearer ${memberToken}`
            }
        });
        await expect(workspacesResponse.json()).resolves.toMatchObject({
            ok: true,
            workspaces: expect.arrayContaining([
                expect.objectContaining({
                    userId: workspace.id,
                    nametag: workspace.nametag
                })
            ])
        });

        const scopedBeforeKick = await fetch(`http://127.0.0.1:${built.port}/w/${workspace.id}/tools`, {
            headers: {
                authorization: `Bearer ${memberToken}`
            }
        });
        expect(scopedBeforeKick.status).toBe(200);

        const kickResponse = await fetch(
            `http://127.0.0.1:${built.port}/workspaces/${workspace.nametag}/members/${member.id}/kick`,
            {
                method: "POST",
                headers: {
                    authorization: `Bearer ${ownerToken}`,
                    "content-type": "application/json"
                },
                body: JSON.stringify({ reason: "cleanup" })
            }
        );
        await expect(kickResponse.json()).resolves.toEqual({ ok: true });
        await expect(built.storage.workspaceMembers.isKicked(workspace.id, member.id)).resolves.toBe(true);

        const scopedAfterKick = await fetch(`http://127.0.0.1:${built.port}/w/${workspace.id}/tools`, {
            headers: {
                authorization: `Bearer ${memberToken}`
            }
        });
        expect(scopedAfterKick.status).toBe(403);
        await expect(scopedAfterKick.json()).resolves.toEqual({
            ok: false,
            error: "Workspace access denied."
        });
    });

    it("normalizes legacy Telegram session tokens to internal user ids", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await appServerCreateForTests({ secret });
        const legacyTelegramToken = await jwtSign({ userId: "123" }, secret, 3600);

        const response = await fetch(`http://127.0.0.1:${built.port}/auth/validate`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token: legacyTelegramToken })
        });

        const payload = (await response.json()) as {
            ok: boolean;
            userId?: string;
            token?: string;
            expiresAt?: number;
        };
        expect(payload.ok).toBe(true);
        expect(typeof payload.userId).toBe("string");
        expect(typeof payload.token).toBe("string");
        const mappedUser = await built.storage.resolveUserByConnectorKey(userConnectorKeyCreate("telegram", "123"));
        expect(payload.userId).toBe(mappedUser.id);
        const verified = await jwtVerify(payload.token!, secret);
        expect(verified.userId).toBe(mappedUser.id);
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

function appServerEmailTokenExtract(text: string): string {
    const match = text.match(/https?:\/\/\S+/);
    if (!match?.[0]) {
        throw new Error("Expected auth URL in email body.");
    }

    const url = new URL(match[0]);
    const encoded = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
    if (!encoded) {
        throw new Error("Expected auth hash payload.");
    }

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as { token?: unknown };
    if (typeof payload.token !== "string" || payload.token.trim().length === 0) {
        throw new Error("Expected email token in auth payload.");
    }
    return payload.token;
}

describe("AppServer authenticated routes", () => {
    it("supports app-agent create/send/read/delete lifecycle", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const history = new Map<string, Array<{ type: "user_message" | "assistant_message"; at: number }>>();
        const chats = new Map<
            string,
            {
                agentId: string;
                path: string;
                kind: "app";
                name: string | null;
                description: string | null;
                connectorName: null;
                foreground: false;
                lifecycle: "active" | "sleeping" | "dead";
                createdAt: number;
                updatedAt: number;
                userId: string;
            }
        >();
        const callbacks: RouteAgentCallbacks = {
            agentList: async () => Array.from(chats.values()),
            agentHistoryLoad: async (_ctx, agentId) =>
                (history.get(agentId) ?? []).map((entry) =>
                    entry.type === "user_message"
                        ? { type: "user_message" as const, at: entry.at, text: "hello", files: [] }
                        : { type: "assistant_message" as const, at: entry.at, content: [], tokens: null }
                ),
            agentHistoryLoadAfter: async (_ctx, agentId, after) =>
                (history.get(agentId) ?? [])
                    .filter((entry) => entry.at > after)
                    .map((entry) =>
                        entry.type === "user_message"
                            ? { type: "user_message" as const, at: entry.at, text: "hello", files: [] }
                            : { type: "assistant_message" as const, at: entry.at, content: [], tokens: null }
                    ),
            agentCreate: async (ctx) => {
                const createdAt = 1_700_000_000_000;
                chats.set("app-agent-1", {
                    agentId: "app-agent-1",
                    path: `/${ctx.userId}/app/app-agent-1`,
                    kind: "app",
                    name: "App chat",
                    description: null,
                    connectorName: null,
                    foreground: false,
                    lifecycle: "active",
                    createdAt,
                    updatedAt: createdAt,
                    userId: ctx.userId
                });
                return { agentId: "app-agent-1", initializedAt: createdAt };
            },
            agentKill: async (_ctx, agentId) => {
                const exists = chats.has(agentId);
                chats.delete(agentId);
                return exists;
            },
            agentPost: async (_ctx, target, item) => {
                if (!("agentId" in target)) {
                    return;
                }
                const list = history.get(target.agentId) ?? [];
                if (item.type === "message") {
                    const now = Date.now();
                    list.push({ type: "user_message", at: now });
                    list.push({ type: "assistant_message", at: now + 1 });
                    const existing = chats.get(target.agentId);
                    if (existing) {
                        existing.updatedAt = now + 1;
                    }
                }
                history.set(target.agentId, list);
            },
            agentDirectResolve: async (_ctx) => {
                return "direct-agent-id";
            }
        };
        const built = await appServerCreateForTests({ secret, agentCallbacks: callbacks });
        const token = await jwtSign({ userId: "user-1" }, secret, 3600);

        const created = await fetch(`http://127.0.0.1:${built.port}/agents/create`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${token}`,
                "content-type": "application/json"
            },
            body: JSON.stringify({
                systemPrompt: "You are started from app."
            })
        });
        expect(created.status).toBe(200);
        await expect(created.json()).resolves.toEqual({
            ok: true,
            agent: {
                agentId: "app-agent-1",
                initializedAt: 1_700_000_000_000
            }
        });

        const listedChats = await fetch(`http://127.0.0.1:${built.port}/agents/chats`, {
            headers: { authorization: `Bearer ${token}` }
        });
        expect(listedChats.status).toBe(200);
        await expect(listedChats.json()).resolves.toEqual({
            ok: true,
            chats: [
                {
                    agentId: "app-agent-1",
                    name: "App chat",
                    description: null,
                    lifecycle: "active",
                    createdAt: 1_700_000_000_000,
                    updatedAt: 1_700_000_000_000
                }
            ]
        });

        const sent = await fetch(`http://127.0.0.1:${built.port}/agents/app-agent-1/messages/create`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${token}`,
                "content-type": "application/json"
            },
            body: JSON.stringify({
                text: "Hello app agent"
            })
        });
        expect(sent.status).toBe(200);
        await expect(sent.json()).resolves.toEqual({ ok: true });

        const read = await fetch(`http://127.0.0.1:${built.port}/agents/app-agent-1/messages?after=0`, {
            headers: { authorization: `Bearer ${token}` }
        });
        expect(read.status).toBe(200);
        const readBody = (await read.json()) as { ok: boolean; history: Array<{ type: string; at: number }> };
        expect(readBody.ok).toBe(true);
        expect(readBody.history.map((entry) => entry.type)).toEqual(["user_message", "assistant_message"]);

        const killed = await fetch(`http://127.0.0.1:${built.port}/agents/app-agent-1/delete`, {
            method: "POST",
            headers: { authorization: `Bearer ${token}` }
        });
        expect(killed.status).toBe(200);
        await expect(killed.json()).resolves.toEqual({ ok: true, deleted: true });

        const listedAfterDelete = await fetch(`http://127.0.0.1:${built.port}/agents/chats`, {
            headers: { authorization: `Bearer ${token}` }
        });
        expect(listedAfterDelete.status).toBe(200);
        await expect(listedAfterDelete.json()).resolves.toEqual({ ok: true, chats: [] });
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

    it("returns structured 400 for invalid cron timezone", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await appServerCreateForTests({
            secret,
            taskCallbacks: taskCallbacksBuild()
        });
        const token = await jwtSign({ userId: "user-1" }, secret, 3600);

        const response = await fetch(`http://127.0.0.1:${built.port}/tasks/task-1/triggers/add`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${token}`,
                "content-type": "application/json"
            },
            body: JSON.stringify({
                type: "cron",
                schedule: "0 * * * *",
                timezone: "Not/AZone"
            })
        });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            ok: false,
            error: "Invalid cron timezone: Not/AZone"
        });
    });

    it("handles secrets CRUD and never returns secret values", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await appServerCreateForTests({ secret });
        const token = await jwtSign({ userId: "user-1" }, secret, 3600);

        const createResponse = await fetch(`http://127.0.0.1:${built.port}/secrets/create`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${token}`,
                "content-type": "application/json"
            },
            body: JSON.stringify({
                name: "openai-key",
                displayName: "OpenAI",
                description: "API credentials",
                variables: {
                    OPENAI_API_KEY: "sk-secret",
                    ENABLED: true
                }
            })
        });

        expect(createResponse.status).toBe(200);
        const createPayload = await createResponse.json();
        expect(createPayload).toEqual({
            ok: true,
            secret: {
                name: "openai-key",
                displayName: "OpenAI",
                description: "API credentials",
                variableNames: ["ENABLED", "OPENAI_API_KEY"],
                variableCount: 2
            }
        });
        expect(JSON.stringify(createPayload)).not.toContain("sk-secret");

        const readResponse = await fetch(`http://127.0.0.1:${built.port}/secrets/openai-key`, {
            headers: { authorization: `Bearer ${token}` }
        });
        expect(readResponse.status).toBe(200);
        const readPayload = await readResponse.json();
        expect(readPayload).toEqual({
            ok: true,
            secret: {
                name: "openai-key",
                displayName: "OpenAI",
                description: "API credentials",
                variableNames: ["ENABLED", "OPENAI_API_KEY"],
                variableCount: 2
            }
        });
        expect(JSON.stringify(readPayload)).not.toContain("sk-secret");

        const updateResponse = await fetch(`http://127.0.0.1:${built.port}/secrets/openai-key/update`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${token}`,
                "content-type": "application/json"
            },
            body: JSON.stringify({
                description: "Updated",
                variables: {
                    OPENAI_API_KEY: "sk-updated"
                }
            })
        });
        expect(updateResponse.status).toBe(200);
        const updatePayload = await updateResponse.json();
        expect(updatePayload).toEqual({
            ok: true,
            secret: {
                name: "openai-key",
                displayName: "OpenAI",
                description: "Updated",
                variableNames: ["OPENAI_API_KEY"],
                variableCount: 1
            }
        });
        expect(JSON.stringify(updatePayload)).not.toContain("sk-updated");

        const listResponse = await fetch(`http://127.0.0.1:${built.port}/secrets`, {
            headers: { authorization: `Bearer ${token}` }
        });
        expect(listResponse.status).toBe(200);
        const listPayload = await listResponse.json();
        expect(listPayload).toEqual({
            ok: true,
            secrets: [
                {
                    name: "openai-key",
                    displayName: "OpenAI",
                    description: "Updated",
                    variableNames: ["OPENAI_API_KEY"],
                    variableCount: 1
                }
            ]
        });
        expect(JSON.stringify(listPayload)).not.toContain("sk-updated");

        const stored = await built.secrets.list(contextForUser({ userId: "user-1" }));
        expect(stored).toEqual([
            {
                name: "openai-key",
                displayName: "OpenAI",
                description: "Updated",
                variables: {
                    OPENAI_API_KEY: "sk-updated"
                }
            }
        ]);

        const deleteResponse = await fetch(`http://127.0.0.1:${built.port}/secrets/openai-key/delete`, {
            method: "POST",
            headers: { authorization: `Bearer ${token}` }
        });
        expect(deleteResponse.status).toBe(200);
        await expect(deleteResponse.json()).resolves.toEqual({
            ok: true,
            deleted: true
        });
    });

    it("handles per-user key-value CRUD", async () => {
        const secret = "valid-secret-for-tests-1234567890";
        const built = await appServerCreateForTests({ secret });
        const tokenA = await jwtSign({ userId: "user-a" }, secret, 3600);
        const tokenB = await jwtSign({ userId: "user-b" }, secret, 3600);

        const createResponse = await fetch(`http://127.0.0.1:${built.port}/kv/create`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${tokenA}`,
                "content-type": "application/json"
            },
            body: JSON.stringify({
                key: "profile",
                value: { theme: "dark", count: 1 }
            })
        });
        expect(createResponse.status).toBe(200);
        const createPayload = await createResponse.json();
        expect(createPayload).toEqual({
            ok: true,
            entry: {
                key: "profile",
                value: { theme: "dark", count: 1 },
                createdAt: expect.any(Number),
                updatedAt: expect.any(Number)
            }
        });

        const readResponse = await fetch(`http://127.0.0.1:${built.port}/kv/profile`, {
            headers: { authorization: `Bearer ${tokenA}` }
        });
        expect(readResponse.status).toBe(200);
        await expect(readResponse.json()).resolves.toEqual({
            ok: true,
            entry: {
                key: "profile",
                value: { theme: "dark", count: 1 },
                createdAt: expect.any(Number),
                updatedAt: expect.any(Number)
            }
        });

        const updateResponse = await fetch(`http://127.0.0.1:${built.port}/kv/profile/update`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${tokenA}`,
                "content-type": "application/json"
            },
            body: JSON.stringify({
                value: { theme: "light", count: 2 }
            })
        });
        expect(updateResponse.status).toBe(200);
        await expect(updateResponse.json()).resolves.toEqual({
            ok: true,
            entry: {
                key: "profile",
                value: { theme: "light", count: 2 },
                createdAt: expect.any(Number),
                updatedAt: expect.any(Number)
            }
        });

        const listResponse = await fetch(`http://127.0.0.1:${built.port}/kv`, {
            headers: { authorization: `Bearer ${tokenA}` }
        });
        expect(listResponse.status).toBe(200);
        await expect(listResponse.json()).resolves.toEqual({
            ok: true,
            entries: [
                {
                    key: "profile",
                    value: { theme: "light", count: 2 },
                    createdAt: expect.any(Number),
                    updatedAt: expect.any(Number)
                }
            ]
        });

        const otherUserRead = await fetch(`http://127.0.0.1:${built.port}/kv/profile`, {
            headers: { authorization: `Bearer ${tokenB}` }
        });
        expect(otherUserRead.status).toBe(404);
        await expect(otherUserRead.json()).resolves.toEqual({
            ok: false,
            error: "Entry not found."
        });

        const deleteResponse = await fetch(`http://127.0.0.1:${built.port}/kv/profile/delete`, {
            method: "POST",
            headers: { authorization: `Bearer ${tokenA}` }
        });
        expect(deleteResponse.status).toBe(200);
        await expect(deleteResponse.json()).resolves.toEqual({
            ok: true,
            deleted: true
        });
    });
});
