import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { AgentDescriptor, Connector, ConnectorMessage, MessageContext } from "@/types";
import { configResolve } from "../config/configResolve.js";
import { Engine } from "./engine.js";
import { EngineEventBus } from "./ipc/events.js";

describe("Engine reset command", () => {
  it("posts reset with message context for user commands", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
    try {
      const config = configResolve(
        { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
        path.join(dir, "settings.json")
      );
      const engine = new Engine({ config, eventBus: new EngineEventBus() });
      const postSpy = vi.spyOn(engine.agentSystem, "post").mockResolvedValue(undefined);

      const sendMessage = vi.fn(async () => undefined);
      const commandState: {
        handler?: (command: string, context: MessageContext, descriptor: AgentDescriptor) => void | Promise<void>;
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

      expect(postSpy).toHaveBeenCalledWith(
        { descriptor },
        { type: "reset", message: "Manual reset requested by the user.", context }
      );
      expect(sendMessage).not.toHaveBeenCalled();

      await engine.modules.connectors.unregisterAll("test");
      await engine.shutdown();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("Engine stop command", () => {
  it("aborts active inference for user commands and confirms in channel", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
    try {
      const config = configResolve(
        { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
        path.join(dir, "settings.json")
      );
      const engine = new Engine({ config, eventBus: new EngineEventBus() });
      vi.spyOn(engine.agentSystem, "abortInferenceForTarget").mockReturnValue(true);
      const postSpy = vi.spyOn(engine.agentSystem, "post").mockResolvedValue(undefined);

      const sendMessage = vi.fn(async () => undefined);
      const commandState: {
        handler?: (command: string, context: MessageContext, descriptor: AgentDescriptor) => void | Promise<void>;
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

      await commandHandler("/stop", context, descriptor);

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

describe("Engine message batching", () => {
  it("debounces and combines connector messages per descriptor", async () => {
    vi.useFakeTimers();
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
    try {
      const config = configResolve(
        { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
        path.join(dir, "settings.json")
      );
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
      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        { descriptor },
        {
          type: "message",
          message: { text: "first\nsecond", rawText: "first\nsecond" },
          context: { messageId: "2" }
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

describe("Engine permission callbacks", () => {
  it("resolves pending permission requests via the registry", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
    try {
      const config = configResolve(
        { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
        path.join(dir, "settings.json")
      );
      const engine = new Engine({ config, eventBus: new EngineEventBus() });
      const resolveSpy = vi
        .spyOn(engine.permissionRequestRegistry, "resolve")
        .mockReturnValue(true);
      vi.spyOn(engine.agentSystem, "getAgentDescriptor").mockReturnValue({
        type: "user",
        connector: "telegram",
        channelId: "123",
        userId: "123"
      });
      const postSpy = vi.spyOn(engine.agentSystem, "post").mockResolvedValue(undefined);
      const permissionState: {
        handler?: (
          decision: {
            token: string;
            agentId: string;
            approved: boolean;
            permission: string;
            access: { kind: "network" };
          },
          context: MessageContext,
          descriptor: AgentDescriptor
        ) => void | Promise<void>;
      } = {};

      const connector: Connector = {
        capabilities: { sendText: true },
        onMessage: () => () => undefined,
        onPermission: (handler) => {
          permissionState.handler = handler as typeof permissionState.handler;
          return () => undefined;
        },
        sendMessage: async () => undefined
      };

      const registerResult = engine.modules.connectors.register("telegram", connector);
      expect(registerResult).toEqual({ ok: true, status: "loaded" });
      const handler = permissionState.handler;
      if (!handler) {
        throw new Error("Expected permission handler to be registered");
      }

      const descriptor: AgentDescriptor = {
        type: "user",
        connector: "telegram",
        channelId: "123",
        userId: "123"
      };
      const context: MessageContext = { messageId: "77" };
      const decision = {
        token: "perm-1",
        agentId: "agent-1",
        approved: true,
        permission: "@network",
        access: { kind: "network" as const }
      };

      await handler(decision, context, descriptor);

      expect(resolveSpy).toHaveBeenCalledWith("perm-1", decision);
      expect(postSpy).not.toHaveBeenCalled();

      await engine.modules.connectors.unregisterAll("test");
      await engine.shutdown();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("still sends foreground notice for background requester decisions", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-engine-"));
    try {
      const config = configResolve(
        { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
        path.join(dir, "settings.json")
      );
      const engine = new Engine({ config, eventBus: new EngineEventBus() });
      vi.spyOn(engine.permissionRequestRegistry, "resolve").mockReturnValue(false);
      vi.spyOn(engine.agentSystem, "getAgentDescriptor").mockReturnValue({
        type: "permanent",
        id: "agent-bg",
        name: "worker",
        description: "background worker",
        systemPrompt: "run tasks"
      });
      const postSpy = vi.spyOn(engine.agentSystem, "post").mockResolvedValue(undefined);
      const permissionState: {
        handler?: (
          decision: {
            token: string;
            agentId: string;
            approved: boolean;
            permission: string;
            access: { kind: "network" };
          },
          context: MessageContext,
          descriptor: AgentDescriptor
        ) => void | Promise<void>;
      } = {};

      const connector: Connector = {
        capabilities: { sendText: true },
        onMessage: () => () => undefined,
        onPermission: (handler) => {
          permissionState.handler = handler as typeof permissionState.handler;
          return () => undefined;
        },
        sendMessage: async () => undefined
      };

      const registerResult = engine.modules.connectors.register("telegram", connector);
      expect(registerResult).toEqual({ ok: true, status: "loaded" });
      const handler = permissionState.handler;
      if (!handler) {
        throw new Error("Expected permission handler to be registered");
      }

      const descriptor: AgentDescriptor = {
        type: "user",
        connector: "telegram",
        channelId: "123",
        userId: "123"
      };
      const context: MessageContext = { messageId: "78" };
      const decision = {
        token: "perm-2",
        agentId: "agent-bg",
        approved: false,
        permission: "@network",
        access: { kind: "network" as const }
      };

      await handler(decision, context, descriptor);

      expect(postSpy).toHaveBeenCalledWith(
        { descriptor },
        {
          type: "system_message",
          text: expect.stringContaining("Decision delivered to background agent."),
          origin: "agent-bg",
          context,
          silent: true
        }
      );

      await engine.modules.connectors.unregisterAll("test");
      await engine.shutdown();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
