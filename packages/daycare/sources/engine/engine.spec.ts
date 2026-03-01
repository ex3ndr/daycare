import { promises as fs } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { AgentDescriptor, Connector, ConnectorMessage, MessageContext } from "@/types";
import { configResolve } from "../config/configResolve.js";
import * as dockerContainersStaleRemoveModule from "../sandbox/docker/dockerContainersStaleRemove.js";
import { userConnectorKeyCreate } from "../storage/userConnectorKeyCreate.js";
import { Engine } from "./engine.js";
import { EngineEventBus } from "./ipc/events.js";

describe("Engine reset command", () => {
    it("posts reset with message context for user commands", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            const postSpy = vi.spyOn(engine.agentSystem, "post").mockResolvedValue(undefined);

            const sendMessage = vi.fn(async () => undefined);
            const commandState: {
                handler?: (
                    command: string,
                    context: MessageContext,
                    descriptor: AgentDescriptor
                ) => void | Promise<void>;
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

            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "telegram",
                channelId: "123",
                userId: "123"
            };
            const context: MessageContext = { messageId: "55" };

            await commandHandler("/reset", context, descriptor);

            const user = await engine.storage.resolveUserByConnectorKey(userConnectorKeyCreate("telegram", "123"));
            expect(postSpy).toHaveBeenCalledWith(
                expect.objectContaining({ userId: user.id }),
                { descriptor },
                {
                    type: "reset",
                    message: "Manual reset requested by the user.",
                    context: expect.objectContaining(context)
                }
            );
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
            const state: {
                messageHandler?: (
                    message: ConnectorMessage,
                    context: MessageContext,
                    descriptor: AgentDescriptor
                ) => void | Promise<void>;
                commandHandler?: (
                    command: string,
                    context: MessageContext,
                    descriptor: AgentDescriptor
                ) => void | Promise<void>;
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

            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "telegram",
                channelId: "123",
                userId: "123"
            };
            const messageHandler = state.messageHandler;
            const commandHandler = state.commandHandler;
            if (!messageHandler || !commandHandler) {
                throw new Error("Expected handlers to be registered");
            }

            await messageHandler({ text: "can you check downloads?" }, { messageId: "1" }, descriptor);
            await commandHandler("/reset", { messageId: "2" }, descriptor);
            await vi.advanceTimersByTimeAsync(100);

            const user = await engine.storage.resolveUserByConnectorKey(userConnectorKeyCreate("telegram", "123"));
            expect(postSpy).toHaveBeenCalledTimes(1);
            expect(postSpy).toHaveBeenCalledWith(
                expect.objectContaining({ userId: user.id }),
                { descriptor },
                {
                    type: "reset",
                    message: "Manual reset requested by the user.",
                    context: expect.objectContaining({ messageId: "2" })
                }
            );

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
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            await engine.start();

            const status = engine.getStatus();
            expect(status.tools).toEqual([]);

            await engine.shutdown();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});

describe("Engine timezone mismatch handling", () => {
    it("auto-updates profile timezone and emits enrichment notices", async () => {
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
                    descriptor: AgentDescriptor
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

            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "telegram",
                channelId: "123",
                userId: "123"
            };
            const messageHandler = state.messageHandler;
            if (!messageHandler) {
                throw new Error("Expected message handler to be registered");
            }

            await messageHandler({ text: "seed" }, { messageId: "seed-1" }, descriptor);
            await vi.advanceTimersByTimeAsync(100);
            postSpy.mockClear();

            const user = await engine.storage.resolveUserByConnectorKey(userConnectorKeyCreate("telegram", "123"));
            await engine.storage.users.update(user.id, {
                timezone: "UTC",
                updatedAt: Date.now()
            });

            await messageHandler({ text: "hello" }, { messageId: "msg-1", timezone: "America/New_York" }, descriptor);
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
                        value: "Timezone updated automatically from UTC to America/New_York."
                    },
                    {
                        key: "profile_name_notice",
                        value: "User first/last name are not set. Ask the user and call user_profile_update ASAP."
                    }
                ])
            );

            const updatedUser = await engine.storage.users.findById(user.id);
            expect(updatedUser?.timezone).toBe("America/New_York");

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
            await rm(dir, { recursive: true, force: true });
        }
    });
});

describe("Engine Docker stale container cleanup", () => {
    it("runs startup stale scan when docker is enabled", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        const staleRemoveSpy = vi
            .spyOn(dockerContainersStaleRemoveModule, "dockerContainersStaleRemove")
            .mockResolvedValue(undefined);
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir },
                    docker: { enabled: true, image: "daycare-sandbox", tag: "latest" }
                },
                path.join(dir, "settings.json")
            );
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            await engine.start();

            expect(staleRemoveSpy).toHaveBeenCalledTimes(1);
            expect(staleRemoveSpy).toHaveBeenCalledWith(expect.anything(), "daycare-sandbox:latest");

            await engine.shutdown();
        } finally {
            staleRemoveSpy.mockRestore();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("skips startup stale scan when docker is disabled", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        const staleRemoveSpy = vi
            .spyOn(dockerContainersStaleRemoveModule, "dockerContainersStaleRemove")
            .mockResolvedValue(undefined);
        try {
            const config = configResolve(
                { engine: { dataDir: dir }, docker: { enabled: false } },
                path.join(dir, "settings.json")
            );
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            await engine.start();

            expect(staleRemoveSpy).not.toHaveBeenCalled();

            await engine.shutdown();
        } finally {
            staleRemoveSpy.mockRestore();
            await rm(dir, { recursive: true, force: true });
        }
    });
});

describe("Engine expose lifecycle", () => {
    it("starts and stops expose module with engine lifecycle", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            const startSpy = vi.spyOn(engine.exposes, "start").mockResolvedValue(undefined);
            const stopSpy = vi.spyOn(engine.exposes, "stop").mockResolvedValue(undefined);

            await engine.start();
            await engine.shutdown();

            expect(startSpy).toHaveBeenCalledTimes(1);
            expect(stopSpy).toHaveBeenCalledTimes(1);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});

describe("Engine tool registration", () => {
    it("registers the skill tool in normal mode", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
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
            await rm(dir, { recursive: true, force: true });
        }
    });
});

describe("Engine app registration", () => {
    it("discovers apps on startup and registers app tools", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
        try {
            const appDir = path.join(dir, "users", "user-1", "apps", "github-reviewer");
            await fs.mkdir(appDir, { recursive: true });
            await fs.writeFile(
                path.join(appDir, "APP.md"),
                [
                    "---",
                    "name: github-reviewer",
                    "title: GitHub Reviewer",
                    "description: Reviews pull requests",
                    "---",
                    "",
                    "## System Prompt",
                    "",
                    "You are a focused PR review assistant."
                ].join("\n")
            );
            await fs.writeFile(
                path.join(appDir, "PERMISSIONS.md"),
                [
                    "## Source Intent",
                    "",
                    "Review pull requests safely.",
                    "",
                    "## Rules",
                    "",
                    "### Allow",
                    "- Read files",
                    "",
                    "### Deny",
                    "- Delete files"
                ].join("\n")
            );

            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            await engine.start();

            const toolNames = engine.modules.tools.listTools().map((tool) => tool.name);
            expect(toolNames).toContain("install_app");
            expect(toolNames).toContain("app_rules");
            expect(toolNames).toContain("app_github_reviewer");

            await engine.shutdown();
        } finally {
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
            const postSpy = vi.spyOn(engine.agentSystem, "post").mockResolvedValue(undefined);

            const sendMessage = vi.fn(async () => undefined);
            const commandState: {
                handler?: (
                    command: string,
                    context: MessageContext,
                    descriptor: AgentDescriptor
                ) => void | Promise<void>;
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

            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "telegram",
                channelId: "123",
                userId: "123"
            };
            const context: MessageContext = { messageId: "56" };

            await commandHandler("/abort", context, descriptor);

            expect(engine.agentSystem.abortInferenceForTarget).toHaveBeenCalledWith({ descriptor });
            expect(sendMessage).toHaveBeenCalledWith("123", {
                text: "Stopped current inference.",
                replyToMessageId: "56"
            });
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

            const sendMessage = vi.fn(async () => undefined);
            const commandState: {
                handler?: (
                    command: string,
                    context: MessageContext,
                    descriptor: AgentDescriptor
                ) => void | Promise<void>;
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

            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "telegram",
                channelId: "123",
                userId: "123"
            };
            const context: MessageContext = { messageId: "57" };

            await commandHandler("/compact", context, descriptor);

            const user = await engine.storage.resolveUserByConnectorKey(userConnectorKeyCreate("telegram", "123"));
            expect(postSpy).toHaveBeenCalledWith(
                expect.objectContaining({ userId: user.id }),
                { descriptor },
                { type: "compact", context: expect.objectContaining(context) }
            );
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
                handler?: (
                    command: string,
                    context: MessageContext,
                    descriptor: AgentDescriptor
                ) => void | Promise<void>;
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

            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "telegram",
                channelId: "123",
                userId: "123"
            };
            const context: MessageContext = { messageId: "56" };
            await commandHandler("/upgrade now", context, descriptor);

            expect(pluginHandler).toHaveBeenCalledWith("/upgrade now", expect.objectContaining(context), descriptor);

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
                    descriptor: AgentDescriptor
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

            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "telegram",
                channelId: "123",
                userId: "123"
            };
            await handler({ text: "first" }, { messageId: "1" }, descriptor);
            await vi.advanceTimersByTimeAsync(50);
            await handler({ text: "second" }, { messageId: "2" }, descriptor);
            await vi.advanceTimersByTimeAsync(99);
            expect(postSpy).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(1);
            const user = await engine.storage.resolveUserByConnectorKey(userConnectorKeyCreate("telegram", "123"));
            expect(postSpy).toHaveBeenCalledTimes(1);
            expect(postSpy).toHaveBeenCalledWith(
                expect.objectContaining({ userId: user.id }),
                { descriptor },
                {
                    type: "message",
                    message: { text: "first\nsecond", rawText: "first\nsecond" },
                    context: expect.objectContaining({ messageId: "2" })
                }
            );

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
                    descriptor: AgentDescriptor
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

            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "telegram",
                channelId: "123",
                userId: "123"
            };
            await handler({ text: "   " }, { messageId: "1" }, descriptor);
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
                    descriptor: AgentDescriptor
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

            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "telegram",
                channelId: "123",
                userId: "123"
            };
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
                { messageId: "1" },
                descriptor
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
