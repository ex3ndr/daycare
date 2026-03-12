import { promises as fs } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { AgentPath, Connector, ConnectorMessage, Context, MessageContext } from "@/types";
import { configResolve } from "../config/configResolve.js";
import * as dockerContainersStaleRemoveModule from "../sandbox/docker/dockerContainersStaleRemove.js";
import * as dockerImageIdResolveModule from "../sandbox/docker/dockerImageIdResolve.js";
import { storageOpen } from "../storage/storageOpen.js";
import { userConnectorKeyCreate } from "../storage/userConnectorKeyCreate.js";
import { contextForUser } from "./agents/context.js";
import { agentPathConnector } from "./agents/ops/agentPathBuild.js";
import { Engine } from "./engine.js";
import { EngineEventBus } from "./ipc/events.js";

describe("Engine reset command", () => {
    it("posts reset with message context for user commands", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            const postSpy = vi.spyOn(engine.agentSystem, "post").mockResolvedValue(undefined);
            const existingAgentIdForTargetSpy = vi
                .spyOn(engine.agentSystem, "existingAgentIdForTarget")
                .mockResolvedValue("agent-1");

            const sendMessage = vi.fn(async () => undefined);
            const commandState: {
                handler?: (command: string, context: MessageContext, target: AgentPath) => void | Promise<void>;
            } = {};

            const connector: Connector = {
                capabilities: { sendText: true },
                onMessage: () => () => undefined,
                onCommand: (handler) => {
                    commandState.handler = handler;
                    return () => undefined;
                },
                sendMessage
            };

            const registerResult = engine.modules.connectors.register("telegram", connector);
            expect(registerResult).toEqual({ ok: true, status: "loaded" });
            const commandHandler = commandState.handler;
            if (!commandHandler) {
                throw new Error("Expected command handler to be registered");
            }

            const target = agentPathConnector("123", "telegram");
            const context: MessageContext = { messageId: "55", connectorKey: "telegram:123" };

            await commandHandler("/reset", context, target);

            expect(postSpy).toHaveBeenCalledTimes(1);
            const postCall = postSpy.mock.calls[0];
            if (!postCall) {
                throw new Error("Expected reset post call");
            }
            const ctx = postCall[0] as { userId: string };
            const postTarget = postCall[1] as { agentId: string };
            const payload = postCall[2] as { type: string; message: string; context: MessageContext };
            expect(existingAgentIdForTargetSpy).toHaveBeenCalledWith(
                ctx,
                {
                    path: expect.stringMatching(/^\/[^/]+\/telegram$/)
                },
                {
                    kind: "connector",
                    foreground: true,
                    connectorName: "telegram",
                    connectorKey: "telegram:123"
                }
            );
            expect(postTarget.agentId).toBe("agent-1");
            expect(payload).toEqual({
                type: "reset",
                message: "Manual reset requested by the user.",
                context: expect.objectContaining(context)
            });
            expect(sendMessage).not.toHaveBeenCalled();

            await engine.modules.connectors.unregisterAll("test");
            await engine.shutdown();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("drops pending debounced messages for descriptor before reset", async () => {
        vi.useFakeTimers();
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            const postSpy = vi.spyOn(engine.agentSystem, "post").mockResolvedValue(undefined);
            const existingAgentIdForTargetSpy = vi
                .spyOn(engine.agentSystem, "existingAgentIdForTarget")
                .mockResolvedValue("agent-1");
            const state: {
                messageHandler?: (
                    message: ConnectorMessage,
                    context: MessageContext,
                    target: AgentPath
                ) => void | Promise<void>;
                commandHandler?: (command: string, context: MessageContext, target: AgentPath) => void | Promise<void>;
            } = {};

            const connector: Connector = {
                capabilities: { sendText: true },
                onMessage: (handler) => {
                    state.messageHandler = handler;
                    return () => undefined;
                },
                onCommand: (handler) => {
                    state.commandHandler = handler;
                    return () => undefined;
                },
                sendMessage: async () => undefined
            };

            const registerResult = engine.modules.connectors.register("telegram", connector);
            expect(registerResult).toEqual({ ok: true, status: "loaded" });

            const target = agentPathConnector("123", "telegram");
            const messageHandler = state.messageHandler;
            const commandHandler = state.commandHandler;
            if (!messageHandler || !commandHandler) {
                throw new Error("Expected handlers to be registered");
            }

            await messageHandler(
                { text: "can you check downloads?" },
                { messageId: "1", connectorKey: "telegram:123" },
                target
            );
            await commandHandler("/reset", { messageId: "2", connectorKey: "telegram:123" }, target);
            await vi.advanceTimersByTimeAsync(100);

            expect(postSpy).toHaveBeenCalledTimes(1);
            const postCall = postSpy.mock.calls[0];
            if (!postCall) {
                throw new Error("Expected reset post call");
            }
            const ctx = postCall[0] as { userId: string };
            const postTarget = postCall[1] as { agentId: string };
            const payload = postCall[2] as { type: string; message: string; context: MessageContext };
            expect(existingAgentIdForTargetSpy).toHaveBeenCalledWith(
                ctx,
                {
                    path: expect.stringMatching(/^\/[^/]+\/telegram$/)
                },
                {
                    kind: "connector",
                    foreground: true,
                    connectorName: "telegram",
                    connectorKey: "telegram:123"
                }
            );
            expect(postTarget.agentId).toBe("agent-1");
            expect(payload).toEqual({
                type: "reset",
                message: "Manual reset requested by the user.",
                context: expect.objectContaining({ messageId: "2" })
            });

            await engine.modules.connectors.unregisterAll("test");
            await engine.shutdown();
        } finally {
            vi.useRealTimers();
            await rm(dir, { recursive: true, force: true });
        }
    });
});

describe("Engine context tool list", () => {
    it("exposes no classical tools in model context", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        const staleRemoveSpy = vi
            .spyOn(dockerContainersStaleRemoveModule, "dockerContainersStaleRemove")
            .mockResolvedValue(undefined);
        const imageIdSpy = vi
            .spyOn(dockerImageIdResolveModule, "dockerImageIdResolve")
            .mockResolvedValue("sha256:test");
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            await engine.start();

            const status = engine.getStatus();
            expect(status.tools).toEqual([]);

            await engine.shutdown();
        } finally {
            imageIdSpy.mockRestore();
            staleRemoveSpy.mockRestore();
            await rm(dir, { recursive: true, force: true });
        }
    });
});

describe("Engine app costs wiring", () => {
    it("scopes token stats fetch to ctx user", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });

            const findManySpy = vi.spyOn(engine.storage.tokenStats, "findMany").mockResolvedValue([]);
            const findAllSpy = vi.spyOn(engine.storage.tokenStats, "findAll").mockResolvedValue([]);

            const appServer = engine.appServer as unknown as {
                tokenStatsFetch: (ctx: Context, options: { from?: number; to?: number }) => Promise<unknown[]>;
            };
            const ctx = { userId: "user-1" } as Context;
            const options = { from: 100, to: 200 };
            await appServer.tokenStatsFetch(ctx, options);

            expect(findManySpy).toHaveBeenCalledWith(ctx, options);
            expect(findAllSpy).not.toHaveBeenCalled();

            await engine.shutdown();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});

describe("Engine timezone mismatch handling", () => {
    it("emits timezone update guidance enrichments when context timezone differs", async () => {
        vi.useFakeTimers();
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            const postSpy = vi.spyOn(engine.agentSystem, "post").mockResolvedValue(undefined);
            const state: {
                messageHandler?: (
                    message: ConnectorMessage,
                    context: MessageContext,
                    target: AgentPath
                ) => void | Promise<void>;
            } = {};

            const connector: Connector = {
                capabilities: { sendText: true },
                onMessage: (handler) => {
                    state.messageHandler = handler;
                    return () => undefined;
                },
                onCommand: () => () => undefined,
                sendMessage: async () => undefined
            };

            const registerResult = engine.modules.connectors.register("telegram", connector);
            expect(registerResult).toEqual({ ok: true, status: "loaded" });

            const target = agentPathConnector("123", "telegram");
            const messageHandler = state.messageHandler;
            if (!messageHandler) {
                throw new Error("Expected message handler to be registered");
            }

            await messageHandler({ text: "seed" }, { messageId: "seed-1" }, target);
            await vi.advanceTimersByTimeAsync(100);
            postSpy.mockClear();

            const user = await engine.storage.resolveUserByConnectorKey(userConnectorKeyCreate("telegram", "123"));
            await engine.storage.users.update(user.id, {
                timezone: "UTC",
                updatedAt: Date.now()
            });

            await messageHandler({ text: "hello" }, { messageId: "msg-1", timezone: "America/New_York" }, target);
            await vi.advanceTimersByTimeAsync(100);

            expect(postSpy).toHaveBeenCalledTimes(1);
            const call = postSpy.mock.calls[0];
            if (!call) {
                throw new Error("Expected agent post call");
            }
            const postedMessage = call[2] as { type: string; message: ConnectorMessage; context: MessageContext };
            expect(postedMessage.type).toBe("message");
            expect(postedMessage.context.timezone).toBe("America/New_York");
            expect(postedMessage.context.enrichments).toEqual(
                expect.arrayContaining([
                    {
                        key: "timezone_change_notice",
                        value: "Message context timezone changed from profile timezone UTC to America/New_York. Update profile timezone with user_profile_update."
                    },
                    {
                        key: "profile_name_notice",
                        value: "User first/last name are not set. If the name is visible from the context (e.g. connector profile, message signature), set it via user_profile_update. Otherwise, ask the user for their name."
                    }
                ])
            );

            const updatedUser = await engine.storage.users.findById(user.id);
            expect(updatedUser?.timezone).toBe("UTC");

            await engine.modules.connectors.unregisterAll("test");
            await engine.shutdown();
        } finally {
            vi.useRealTimers();
            await rm(dir, { recursive: true, force: true });
        }
    });
});

describe("Engine startup plugin hooks", () => {
    it("runs preStart hooks before systems and postStart hooks after systems", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        const staleRemoveSpy = vi
            .spyOn(dockerContainersStaleRemoveModule, "dockerContainersStaleRemove")
            .mockResolvedValue(undefined);
        const imageIdSpy = vi
            .spyOn(dockerImageIdResolveModule, "dockerImageIdResolve")
            .mockResolvedValue("sha256:test");
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            const order: string[] = [];

            vi.spyOn(engine.pluginManager, "preStartAll").mockImplementation(async () => {
                order.push("preStart");
            });
            vi.spyOn(engine.agentSystem, "start").mockImplementation(async () => {
                order.push("agentSystem.start");
            });
            vi.spyOn(engine.crons, "start").mockImplementation(async () => {
                order.push("crons.start");
            });
            vi.spyOn(engine.delayedSignals, "start").mockImplementation(async () => {
                order.push("delayedSignals.start");
            });
            vi.spyOn(engine.pluginManager, "postStartAll").mockImplementation(async () => {
                order.push("postStart");
            });

            await engine.start();
            expect(order).toEqual([
                "preStart",
                "agentSystem.start",
                "crons.start",
                "delayedSignals.start",
                "postStart"
            ]);

            await engine.shutdown();
        } finally {
            imageIdSpy.mockRestore();
            staleRemoveSpy.mockRestore();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("discovers workspaces before loading agents so restored sandboxes include workspace mounts", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        const staleRemoveSpy = vi
            .spyOn(dockerContainersStaleRemoveModule, "dockerContainersStaleRemove")
            .mockResolvedValue(undefined);
        const imageIdSpy = vi
            .spyOn(dockerImageIdResolveModule, "dockerImageIdResolve")
            .mockResolvedValue("sha256:test");
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            const discoverSpy = vi.spyOn(engine.workspaces, "discover").mockResolvedValue([]);
            const loadSpy = vi.spyOn(engine.agentSystem, "load").mockResolvedValue();
            vi.spyOn(engine.providerManager, "reload").mockResolvedValue();
            vi.spyOn(engine.processes, "load").mockResolvedValue();
            vi.spyOn(engine.pluginManager, "reload").mockResolvedValue();
            vi.spyOn(engine.appServer, "start").mockResolvedValue();
            vi.spyOn(engine.channels, "load").mockResolvedValue();
            vi.spyOn(engine.pluginManager, "preStartAll").mockResolvedValue();
            vi.spyOn(engine.agentSystem, "start").mockResolvedValue();
            vi.spyOn(engine.crons, "start").mockResolvedValue();
            vi.spyOn(engine.delayedSignals, "start").mockResolvedValue();
            vi.spyOn(engine.pluginManager, "postStartAll").mockResolvedValue();
            vi.spyOn(engine.appServer, "stop").mockResolvedValue();
            vi.spyOn(engine.modules.connectors, "unregisterAll").mockResolvedValue();
            vi.spyOn(engine.pluginManager, "unloadAll").mockResolvedValue();

            await engine.start();

            const discoverOrder = discoverSpy.mock.invocationCallOrder[0] ?? 0;
            const loadOrder = loadSpy.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER;
            expect(discoverOrder).toBeGreaterThan(0);
            expect(discoverOrder).toBeLessThan(loadOrder);

            await engine.shutdown();
        } finally {
            imageIdSpy.mockRestore();
            staleRemoveSpy.mockRestore();
            await rm(dir, { recursive: true, force: true });
        }
    });
});

describe("Engine Docker stale container cleanup", () => {
    it("runs startup stale scan when docker image is available", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        const staleRemoveSpy = vi
            .spyOn(dockerContainersStaleRemoveModule, "dockerContainersStaleRemove")
            .mockResolvedValue(undefined);
        const imageIdSpy = vi
            .spyOn(dockerImageIdResolveModule, "dockerImageIdResolve")
            .mockResolvedValue("sha256:test");
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            await engine.start();

            expect(staleRemoveSpy).toHaveBeenCalledTimes(1);
            expect(imageIdSpy).toHaveBeenCalledTimes(1);
            expect(staleRemoveSpy).toHaveBeenCalledWith(expect.anything(), "daycare-runtime:latest");

            await engine.shutdown();
        } finally {
            imageIdSpy.mockRestore();
            staleRemoveSpy.mockRestore();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("fails startup when the required docker image is missing", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        const staleRemoveSpy = vi.spyOn(dockerContainersStaleRemoveModule, "dockerContainersStaleRemove");
        const imageIdSpy = vi
            .spyOn(dockerImageIdResolveModule, "dockerImageIdResolve")
            .mockRejectedValue(new Error("missing"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            await expect(engine.start()).rejects.toThrow("Required Docker image daycare-runtime:latest is missing.");
            expect(staleRemoveSpy).not.toHaveBeenCalled();
        } finally {
            imageIdSpy.mockRestore();
            staleRemoveSpy.mockRestore();
            await rm(dir, { recursive: true, force: true });
        }
    });
});

describe("Engine tool registration", () => {
    it("registers the skill tool in normal mode", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        const staleRemoveSpy = vi
            .spyOn(dockerContainersStaleRemoveModule, "dockerContainersStaleRemove")
            .mockResolvedValue(undefined);
        const imageIdSpy = vi
            .spyOn(dockerImageIdResolveModule, "dockerImageIdResolve")
            .mockResolvedValue("sha256:test");
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            await engine.start();

            const toolNames = engine.modules.tools.listTools().map((tool) => tool.name);
            expect(toolNames).toContain("skill");
            expect(toolNames).toContain("agent_reset");
            expect(toolNames).toContain("agent_compact");
            expect(toolNames).toContain("user_profile_update");

            await engine.shutdown();
        } finally {
            imageIdSpy.mockRestore();
            staleRemoveSpy.mockRestore();
            await rm(dir, { recursive: true, force: true });
        }
    });
});

describe("Engine workspace registration", () => {
    it("bootstraps the ownerless system workspace on startup", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        const staleRemoveSpy = vi
            .spyOn(dockerContainersStaleRemoveModule, "dockerContainersStaleRemove")
            .mockResolvedValue(undefined);
        const imageIdSpy = vi
            .spyOn(dockerImageIdResolveModule, "dockerImageIdResolve")
            .mockResolvedValue("sha256:test");
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            await engine.start();

            const workspace = await engine.storage.users.findByNametag("##system##");
            if (!workspace) {
                throw new Error("Expected system workspace.");
            }

            const ctx = contextForUser({ userId: workspace.id });
            const document = await engine.storage.documents.findBySlugAndParent(ctx, "document", null);
            const system = await engine.storage.documents.findBySlugAndParent(ctx, "system", null);
            const soul = system ? await engine.storage.documents.findBySlugAndParent(ctx, "soul", system.id) : null;

            expect(workspace.isWorkspace).toBe(true);
            expect(workspace.id).toBe("system");
            expect(workspace.workspaceOwnerId).toBeNull();
            expect(workspace.emoji).toBe("❌");
            expect(workspace.systemPrompt).toBeNull();
            expect(workspace.configuration).toEqual({
                homeReady: true,
                appReady: true,
                bootstrapStarted: false
            });
            expect(document?.slug).toBe("document");
            expect(system?.slug).toBe("system");
            expect(typeof soul?.body).toBe("string");
            expect(soul?.body.length).toBeGreaterThan(0);

            await engine.shutdown();
        } finally {
            imageIdSpy.mockRestore();
            staleRemoveSpy.mockRestore();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("discovers workspaces on startup and exposes workspace_create", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        const staleRemoveSpy = vi
            .spyOn(dockerContainersStaleRemoveModule, "dockerContainersStaleRemove")
            .mockResolvedValue(undefined);
        const imageIdSpy = vi
            .spyOn(dockerImageIdResolveModule, "dockerImageIdResolve")
            .mockResolvedValue("sha256:test");
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const seedStorage = await storageOpen(config.db.path, {
                url: config.db.url,
                autoMigrate: true
            });
            try {
                const owner = await seedStorage.users.create({
                    id: "sy45wijd1hmr03ef2wu7busv",
                    createdAt: 0,
                    updatedAt: 0,
                    nametag: "owner"
                });
                await seedStorage.users.create({
                    id: "workspace-user-1",
                    workspaceOwnerId: owner.id,
                    isWorkspace: true,
                    nametag: "github-reviewer",
                    firstName: "GitHub",
                    lastName: "Reviewer",
                    bio: "Reviews pull requests",
                    about: "PR-focused assistant",
                    systemPrompt: "You are a focused PR review assistant.",
                    memory: false
                });
            } finally {
                seedStorage.connection.close();
            }

            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            await engine.start();

            const toolNames = engine.modules.tools.listTools().map((tool) => tool.name);
            const ctx = contextForUser({ userId: "workspace-user-1" });
            const memory = await engine.storage.documents.findBySlugAndParent(ctx, "memory", null);
            const people = await engine.storage.documents.findBySlugAndParent(ctx, "people", null);
            const document = await engine.storage.documents.findBySlugAndParent(ctx, "document", null);
            const system = await engine.storage.documents.findBySlugAndParent(ctx, "system", null);
            const soul = system ? await engine.storage.documents.findBySlugAndParent(ctx, "soul", system.id) : null;

            expect(toolNames).toContain("workspace_create");
            expect(memory?.slug).toBe("memory");
            expect(people?.slug).toBe("people");
            expect(document?.slug).toBe("document");
            expect(typeof soul?.body).toBe("string");
            expect(soul?.body.length).toBeGreaterThan(0);

            await engine.shutdown();
        } finally {
            imageIdSpy.mockRestore();
            staleRemoveSpy.mockRestore();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("bootstraps documents for all users even when migration is already marked complete", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        const staleRemoveSpy = vi
            .spyOn(dockerContainersStaleRemoveModule, "dockerContainersStaleRemove")
            .mockResolvedValue(undefined);
        const imageIdSpy = vi
            .spyOn(dockerImageIdResolveModule, "dockerImageIdResolve")
            .mockResolvedValue("sha256:test");
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const seedStorage = await storageOpen(config.db.path, {
                url: config.db.url,
                autoMigrate: true
            });
            try {
                const owner = await seedStorage.users.create({
                    id: "sy45wijd1hmr03ef2wu7busv",
                    createdAt: 0,
                    updatedAt: 0,
                    nametag: "owner"
                });
                await seedStorage.users.create({
                    id: "workspace-user-2",
                    workspaceOwnerId: owner.id,
                    isWorkspace: true,
                    nametag: "support-reviewer",
                    firstName: "Support",
                    lastName: "Reviewer",
                    bio: "Reviews support workflows",
                    about: "Support-focused assistant",
                    systemPrompt: "You are a support workspace.",
                    memory: false
                });
                await seedStorage.users.create({
                    id: "friend-user-1",
                    firstName: "Friend",
                    lastName: "User",
                    bio: "Regular user",
                    systemPrompt: null,
                    createdAt: 0,
                    updatedAt: 0,
                    nametag: "friend-user"
                });
            } finally {
                seedStorage.connection.close();
            }

            await fs.mkdir(config.usersDir, { recursive: true });
            await fs.writeFile(path.join(config.usersDir, ".migrated"), "{}\n", "utf8");

            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            await engine.start();

            const workspaceCtx = contextForUser({ userId: "workspace-user-2" });
            const workspaceDocument = await engine.storage.documents.findBySlugAndParent(
                workspaceCtx,
                "document",
                null
            );
            const workspaceSystem = await engine.storage.documents.findBySlugAndParent(workspaceCtx, "system", null);
            const workspaceSoul = workspaceSystem
                ? await engine.storage.documents.findBySlugAndParent(workspaceCtx, "soul", workspaceSystem.id)
                : null;
            const userCtx = contextForUser({ userId: "friend-user-1" });
            const userMemory = await engine.storage.documents.findBySlugAndParent(userCtx, "memory", null);
            const userPeople = await engine.storage.documents.findBySlugAndParent(userCtx, "people", null);
            const userDocument = await engine.storage.documents.findBySlugAndParent(userCtx, "document", null);
            const userSystem = await engine.storage.documents.findBySlugAndParent(userCtx, "system", null);

            expect(workspaceDocument?.slug).toBe("document");
            expect(workspaceSoul?.body).toBe("You are a support workspace.\n");
            expect(userMemory?.slug).toBe("memory");
            expect(userPeople?.slug).toBe("people");
            expect(userDocument?.slug).toBe("document");
            expect(userSystem?.slug).toBe("system");

            await engine.shutdown();
        } finally {
            imageIdSpy.mockRestore();
            staleRemoveSpy.mockRestore();
            await rm(dir, { recursive: true, force: true });
        }
    });
});

describe("Engine abort command", () => {
    it("aborts active inference for user commands and confirms in channel", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            vi.spyOn(engine.agentSystem, "abortInferenceForTarget").mockReturnValue(true);
            vi.spyOn(engine.agentSystem, "existingAgentIdForTarget").mockResolvedValue("agent-1");
            const postSpy = vi.spyOn(engine.agentSystem, "post").mockResolvedValue(undefined);

            const sendMessage = vi.fn(async () => undefined);
            const commandState: {
                handler?: (command: string, context: MessageContext, target: AgentPath) => void | Promise<void>;
            } = {};

            const connector: Connector = {
                capabilities: { sendText: true },
                onMessage: () => () => undefined,
                onCommand: (handler) => {
                    commandState.handler = handler;
                    return () => undefined;
                },
                sendMessage
            };

            const registerResult = engine.modules.connectors.register("telegram", connector);
            expect(registerResult).toEqual({ ok: true, status: "loaded" });
            const commandHandler = commandState.handler;
            if (!commandHandler) {
                throw new Error("Expected command handler to be registered");
            }

            const target = agentPathConnector("123", "telegram");
            const context: MessageContext = { messageId: "56", connectorKey: "telegram:123" };

            await commandHandler("/abort", context, target);

            expect(engine.agentSystem.abortInferenceForTarget).toHaveBeenCalledWith({
                agentId: "agent-1"
            });
            expect(sendMessage).toHaveBeenCalledWith(
                { connectorKey: "telegram:123" },
                {
                    text: "Stopped current inference.",
                    replyToMessageId: "56"
                }
            );
            expect(postSpy).not.toHaveBeenCalled();

            await engine.modules.connectors.unregisterAll("test");
            await engine.shutdown();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});

describe("Engine compact command", () => {
    it("posts compact work for user commands", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            const postSpy = vi.spyOn(engine.agentSystem, "post").mockResolvedValue(undefined);
            const existingAgentIdForTargetSpy = vi
                .spyOn(engine.agentSystem, "existingAgentIdForTarget")
                .mockResolvedValue("agent-1");

            const sendMessage = vi.fn(async () => undefined);
            const commandState: {
                handler?: (command: string, context: MessageContext, target: AgentPath) => void | Promise<void>;
            } = {};

            const connector: Connector = {
                capabilities: { sendText: true },
                onMessage: () => () => undefined,
                onCommand: (handler) => {
                    commandState.handler = handler;
                    return () => undefined;
                },
                sendMessage
            };

            const registerResult = engine.modules.connectors.register("telegram", connector);
            expect(registerResult).toEqual({ ok: true, status: "loaded" });
            const commandHandler = commandState.handler;
            if (!commandHandler) {
                throw new Error("Expected command handler to be registered");
            }

            const target = agentPathConnector("123", "telegram");
            const context: MessageContext = { messageId: "57", connectorKey: "telegram:123" };

            await commandHandler("/compact", context, target);

            expect(postSpy).toHaveBeenCalledTimes(1);
            const postCall = postSpy.mock.calls[0];
            if (!postCall) {
                throw new Error("Expected compact post call");
            }
            const ctx = postCall[0] as { userId: string };
            const postTarget = postCall[1] as { agentId: string };
            const payload = postCall[2] as { type: string; context: MessageContext };
            expect(existingAgentIdForTargetSpy).toHaveBeenCalledWith(
                ctx,
                {
                    path: expect.stringMatching(/^\/[^/]+\/telegram$/)
                },
                {
                    kind: "connector",
                    foreground: true,
                    connectorName: "telegram",
                    connectorKey: "telegram:123"
                }
            );
            expect(postTarget.agentId).toBe("agent-1");
            expect(payload).toEqual({ type: "compact", context: expect.objectContaining(context) });
            expect(sendMessage).not.toHaveBeenCalled();

            await engine.modules.connectors.unregisterAll("test");
            await engine.shutdown();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});

describe("Engine plugin commands", () => {
    it("dispatches unknown slash commands to the plugin command registry", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            const pluginHandler = vi.fn(async () => undefined);
            engine.modules.commands.register("upgrade-plugin", {
                command: "upgrade",
                description: "Upgrade daycare to latest version",
                handler: pluginHandler
            });

            const commandState: {
                handler?: (command: string, context: MessageContext, target: AgentPath) => void | Promise<void>;
            } = {};

            const connector: Connector = {
                capabilities: { sendText: true },
                onMessage: () => () => undefined,
                onCommand: (handler) => {
                    commandState.handler = handler;
                    return () => undefined;
                },
                sendMessage: async () => undefined
            };

            const registerResult = engine.modules.connectors.register("telegram", connector);
            expect(registerResult).toEqual({ ok: true, status: "loaded" });
            const commandHandler = commandState.handler;
            if (!commandHandler) {
                throw new Error("Expected command handler to be registered");
            }

            const target = agentPathConnector("123", "telegram");
            const context: MessageContext = { messageId: "56", connectorKey: "telegram:123" };
            await commandHandler("/upgrade now", context, target);

            expect(pluginHandler).toHaveBeenCalledWith(
                "/upgrade now",
                expect.objectContaining(context),
                expect.stringMatching(/^\/[^/]+\/telegram$/)
            );

            await engine.modules.connectors.unregisterAll("test");
            await engine.shutdown();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});

describe("Engine message batching", () => {
    it("debounces and combines connector messages per descriptor", async () => {
        vi.useFakeTimers();
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            const postSpy = vi.spyOn(engine.agentSystem, "post").mockResolvedValue(undefined);
            const messageState: {
                handler?: (
                    message: ConnectorMessage,
                    context: MessageContext,
                    target: AgentPath
                ) => void | Promise<void>;
            } = {};

            const connector: Connector = {
                capabilities: { sendText: true },
                onMessage: (handler) => {
                    messageState.handler = handler;
                    return () => undefined;
                },
                sendMessage: async () => undefined
            };

            const registerResult = engine.modules.connectors.register("telegram", connector);
            expect(registerResult).toEqual({ ok: true, status: "loaded" });
            const handler = messageState.handler;
            if (!handler) {
                throw new Error("Expected message handler to be registered");
            }

            const target = agentPathConnector("123", "telegram");
            await handler({ text: "first" }, { messageId: "1", connectorKey: "telegram:123" }, target);
            await vi.advanceTimersByTimeAsync(50);
            await handler({ text: "second" }, { messageId: "2", connectorKey: "telegram:123" }, target);
            await vi.advanceTimersByTimeAsync(99);
            expect(postSpy).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(1);
            expect(postSpy).toHaveBeenCalledTimes(1);
            const postCall = postSpy.mock.calls[0];
            if (!postCall) {
                throw new Error("Expected batched post call");
            }
            const ctx = postCall[0] as { userId: string };
            const postTarget = postCall[1] as { path: string };
            const payload = postCall[2] as { type: string; message: ConnectorMessage; context: MessageContext };
            expect(postTarget.path).toMatch(/^\/[^/]+\/telegram$/);
            expect(postTarget.path.split("/")[1]).toBe(ctx.userId);
            expect(payload).toEqual({
                type: "message",
                message: { text: "first\nsecond", rawText: "first\nsecond" },
                context: expect.objectContaining({ messageId: "2" })
            });

            await engine.modules.connectors.unregisterAll("test");
            await engine.shutdown();
        } finally {
            vi.useRealTimers();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("canonicalizes connector callbacks from connectorKey into the stored connector route", async () => {
        vi.useFakeTimers();
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            const postSpy = vi.spyOn(engine.agentSystem, "post").mockResolvedValue(undefined);
            const messageState: {
                handler?: (
                    message: ConnectorMessage,
                    context: MessageContext,
                    target: AgentPath
                ) => void | Promise<void>;
            } = {};

            const connector: Connector = {
                capabilities: { sendText: true },
                onMessage: (handler) => {
                    messageState.handler = handler;
                    return () => undefined;
                },
                sendMessage: async () => undefined
            };

            const registerResult = engine.modules.connectors.register("telegram", connector);
            expect(registerResult).toEqual({ ok: true, status: "loaded" });
            const handler = messageState.handler;
            if (!handler) {
                throw new Error("Expected message handler to be registered");
            }

            await handler(
                { text: "hello" },
                { messageId: "1", connectorKey: "telegram:channel-1/user-7" },
                "/user-7/telegram" as AgentPath
            );
            await vi.advanceTimersByTimeAsync(100);

            expect(postSpy).toHaveBeenCalledTimes(1);
            const call = postSpy.mock.calls[0];
            if (!call) {
                throw new Error("Expected post call");
            }
            const ctx = call[0] as { userId: string };
            const target = call[1] as { path: string };
            expect(target.path).toBe(`/${ctx.userId}/telegram`);

            const user = await engine.storage.resolveUserByConnectorKey(
                userConnectorKeyCreate("telegram", "channel-1/user-7")
            );
            expect(user.id).toBe(ctx.userId);

            await engine.modules.connectors.unregisterAll("test");
            await engine.shutdown();
        } finally {
            vi.useRealTimers();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("uses connectorKey from context for connector user lookup without path suffixes", async () => {
        vi.useFakeTimers();
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            const postSpy = vi.spyOn(engine.agentSystem, "post").mockResolvedValue(undefined);
            const messageState: {
                handler?: (
                    message: ConnectorMessage,
                    context: MessageContext,
                    target: AgentPath
                ) => void | Promise<void>;
            } = {};

            const connector: Connector = {
                capabilities: { sendText: true },
                onMessage: (handler) => {
                    messageState.handler = handler;
                    return () => undefined;
                },
                sendMessage: async () => undefined
            };

            const registerResult = engine.modules.connectors.register("telegram", connector);
            expect(registerResult).toEqual({ ok: true, status: "loaded" });
            const handler = messageState.handler;
            if (!handler) {
                throw new Error("Expected message handler to be registered");
            }

            await handler(
                { text: "hello" },
                { messageId: "1", connectorKey: "telegram:123" },
                "/user-7/telegram" as AgentPath
            );
            await vi.advanceTimersByTimeAsync(100);

            expect(postSpy).toHaveBeenCalledTimes(1);
            const call = postSpy.mock.calls[0];
            if (!call) {
                throw new Error("Expected post call");
            }
            const ctx = call[0] as { userId: string };
            const target = call[1] as { path: string };
            const user = await engine.storage.resolveUserByConnectorKey(userConnectorKeyCreate("telegram", "123"));
            expect(user.id).toBe(ctx.userId);
            expect(target.path).toBe(`/${ctx.userId}/telegram`);

            await engine.modules.connectors.unregisterAll("test");
            await engine.shutdown();
        } finally {
            vi.useRealTimers();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("ignores empty connector messages", async () => {
        vi.useFakeTimers();
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            const postSpy = vi.spyOn(engine.agentSystem, "post").mockResolvedValue(undefined);
            const messageState: {
                handler?: (
                    message: ConnectorMessage,
                    context: MessageContext,
                    target: AgentPath
                ) => void | Promise<void>;
            } = {};

            const connector: Connector = {
                capabilities: { sendText: true },
                onMessage: (handler) => {
                    messageState.handler = handler;
                    return () => undefined;
                },
                sendMessage: async () => undefined
            };

            const registerResult = engine.modules.connectors.register("telegram", connector);
            expect(registerResult).toEqual({ ok: true, status: "loaded" });
            const handler = messageState.handler;
            if (!handler) {
                throw new Error("Expected message handler to be registered");
            }

            const target = agentPathConnector("123", "telegram");
            await handler({ text: "   " }, { messageId: "1", connectorKey: "telegram:123" }, target);
            await vi.advanceTimersByTimeAsync(100);

            expect(postSpy).not.toHaveBeenCalled();

            await engine.modules.connectors.unregisterAll("test");
            await engine.shutdown();
        } finally {
            vi.useRealTimers();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("routes incoming connector files from staging to user downloads before posting", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            const postSpy = vi.spyOn(engine.agentSystem, "post").mockResolvedValue(undefined);
            const messageState: {
                handler?: (
                    message: ConnectorMessage,
                    context: MessageContext,
                    target: AgentPath
                ) => void | Promise<void>;
            } = {};

            const connector: Connector = {
                capabilities: { sendText: true },
                onMessage: (handler) => {
                    messageState.handler = handler;
                    return () => undefined;
                },
                sendMessage: async () => undefined
            };

            const registerResult = engine.modules.connectors.register("telegram", connector);
            expect(registerResult).toEqual({ ok: true, status: "loaded" });
            const handler = messageState.handler;
            if (!handler) {
                throw new Error("Expected message handler to be registered");
            }

            const target = agentPathConnector("123", "telegram");
            const stagedDir = path.join(config.dataDir, "tmp", "staging");
            const stagedPath = path.join(stagedDir, "photo.jpg");
            await fs.mkdir(stagedDir, { recursive: true });
            await fs.writeFile(stagedPath, Buffer.from("image-bytes"));

            await handler(
                {
                    text: "photo",
                    files: [
                        {
                            id: "file-1",
                            name: "photo.jpg",
                            mimeType: "image/jpeg",
                            size: 11,
                            path: stagedPath
                        }
                    ]
                },
                { messageId: "1", connectorKey: "telegram:123" },
                target
            );

            await new Promise((resolve) => setTimeout(resolve, 120));
            const user = await engine.storage.resolveUserByConnectorKey(userConnectorKeyCreate("telegram", "123"));
            const postPayload = postSpy.mock.calls[0]?.[2] as { type: string; message: ConnectorMessage };
            const postedPath = postPayload.message.files?.[0]?.path ?? "";
            const expectedDownloadsDir = path.join(config.usersDir, user.id, "home", "downloads");

            expect(postSpy).toHaveBeenCalledTimes(1);
            expect(postPayload.type).toBe("message");
            expect(postedPath.startsWith(`${path.resolve(expectedDownloadsDir)}${path.sep}`)).toBe(true);
            expect(postedPath).not.toContain(`${path.sep}tmp${path.sep}staging${path.sep}`);
            await expect(fs.access(stagedPath)).rejects.toThrow();

            await engine.modules.connectors.unregisterAll("test");
            await engine.shutdown();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
