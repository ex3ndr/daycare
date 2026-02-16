import { beforeEach, describe, expect, it, vi } from "vitest";

import { plugin } from "./plugin.js";
import { upgradePm2ProcessDetect } from "./upgradePm2ProcessDetect.js";
import { upgradeRestartPendingClear } from "./upgradeRestartPendingClear.js";
import { upgradeRestartPendingSet } from "./upgradeRestartPendingSet.js";
import { upgradeRestartPendingTake } from "./upgradeRestartPendingTake.js";
import { upgradeRestartRun } from "./upgradeRestartRun.js";
import { upgradeRun } from "./upgradeRun.js";

vi.mock("./upgradePm2ProcessDetect.js", () => ({
  upgradePm2ProcessDetect: vi.fn()
}));
vi.mock("./upgradeRun.js", () => ({
  upgradeRun: vi.fn()
}));
vi.mock("./upgradeRestartRun.js", () => ({
  upgradeRestartRun: vi.fn()
}));
vi.mock("./upgradeRestartPendingSet.js", () => ({
  upgradeRestartPendingSet: vi.fn()
}));
vi.mock("./upgradeRestartPendingTake.js", () => ({
  upgradeRestartPendingTake: vi.fn()
}));
vi.mock("./upgradeRestartPendingClear.js", () => ({
  upgradeRestartPendingClear: vi.fn()
}));

describe("upgrade plugin onboarding", () => {
  beforeEach(() => {
    vi.mocked(upgradePm2ProcessDetect).mockReset();
    vi.mocked(upgradeRun).mockReset();
    vi.mocked(upgradeRestartRun).mockReset();
    vi.mocked(upgradeRestartPendingSet).mockReset();
    vi.mocked(upgradeRestartPendingTake).mockReset();
    vi.mocked(upgradeRestartPendingClear).mockReset();
    vi.mocked(upgradeRestartPendingSet).mockResolvedValue(undefined);
    vi.mocked(upgradeRestartPendingTake).mockResolvedValue(null);
    vi.mocked(upgradeRestartPendingClear).mockResolvedValue(undefined);
  });

  it("returns default pm2 settings when daycare process is detected", async () => {
    vi.mocked(upgradePm2ProcessDetect).mockResolvedValue({
      found: true,
      processName: "daycare"
    });
    const note = vi.fn();

    const result = await plugin.onboarding?.({
      instanceId: "upgrade",
      pluginId: "upgrade",
      dataDir: "/tmp/daycare",
      auth: {} as Parameters<NonNullable<typeof plugin.onboarding>>[0]["auth"],
      prompt: {
        input: async () => null,
        confirm: async () => null,
        select: async () => null
      },
      note
    });

    expect(result).toEqual({
      settings: {
        strategy: "pm2",
        processName: "daycare"
      }
    });
    expect(note).toHaveBeenCalledWith(
      'Detected online PM2 process "daycare". Upgrade plugin configured.',
      "Upgrade"
    );
  });

  it("aborts onboarding when daycare process is not detected", async () => {
    vi.mocked(upgradePm2ProcessDetect).mockResolvedValue({
      found: false,
      reason: 'No online PM2 process named "daycare" was found.'
    });
    const note = vi.fn();

    const result = await plugin.onboarding?.({
      instanceId: "upgrade",
      pluginId: "upgrade",
      dataDir: "/tmp/daycare",
      auth: {} as Parameters<NonNullable<typeof plugin.onboarding>>[0]["auth"],
      prompt: {
        input: async () => null,
        confirm: async () => null,
        select: async () => null
      },
      note
    });

    expect(result).toBeNull();
    expect(note).toHaveBeenCalledWith(
      'Upgrade plugin requires an online PM2 process named "daycare". No online PM2 process named "daycare" was found.',
      "Upgrade"
    );
  });
});

describe("upgrade plugin commands", () => {
  it("registers upgrade and restart commands on load and unregisters on unload", async () => {
    const registrar = {
      registerCommand: vi.fn(),
      unregisterCommand: vi.fn(),
      sendMessage: vi.fn(async () => undefined)
    };
    const api = {
      instance: { instanceId: "upgrade", pluginId: "upgrade" },
      settings: { strategy: "pm2", processName: "daycare" },
      engineSettings: {},
      logger: { warn: vi.fn() },
      auth: {},
      dataDir: "/tmp/daycare",
      registrar,
      exposes: {
        registerProvider: async () => undefined,
        unregisterProvider: async () => undefined,
        listProviders: () => []
      },
      fileStore: {},
      inference: { complete: async () => undefined },
      processes: {},
      mode: "runtime",
      events: { emit: () => undefined }
    };

    const instance = await plugin.create(api as never);
    await instance.load?.();

    expect(registrar.registerCommand).toHaveBeenCalledTimes(2);
    expect(registrar.registerCommand).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        command: "upgrade",
        description: "Upgrade daycare to latest version",
        handler: expect.any(Function)
      })
    );
    expect(registrar.registerCommand).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        command: "restart",
        description: "Restart the daycare server process",
        handler: expect.any(Function)
      })
    );

    await instance.unload?.();

    expect(registrar.unregisterCommand).toHaveBeenCalledTimes(2);
    expect(registrar.unregisterCommand).toHaveBeenNthCalledWith(1, "upgrade");
    expect(registrar.unregisterCommand).toHaveBeenNthCalledWith(2, "restart");
  });

  it("dispatches /upgrade and /restart handlers for user descriptors", async () => {
    vi.mocked(upgradeRun).mockResolvedValue(undefined);
    vi.mocked(upgradeRestartRun).mockResolvedValue(undefined);
    const registrar = {
      registerCommand: vi.fn(),
      unregisterCommand: vi.fn(),
      sendMessage: vi.fn(async () => undefined)
    };
    const api = {
      instance: { instanceId: "upgrade", pluginId: "upgrade" },
      settings: { strategy: "pm2", processName: "daycare" },
      engineSettings: {},
      logger: { warn: vi.fn() },
      auth: {},
      dataDir: "/tmp/daycare",
      registrar,
      exposes: {
        registerProvider: async () => undefined,
        unregisterProvider: async () => undefined,
        listProviders: () => []
      },
      fileStore: {},
      inference: { complete: async () => undefined },
      processes: {},
      mode: "runtime",
      events: { emit: () => undefined }
    };
    const instance = await plugin.create(api as never);
    await instance.load?.();
    const commands = registrar.registerCommand.mock.calls.map(
      (call) => call[0] as { command: string; handler: (...args: unknown[]) => Promise<void> }
    );
    const upgradeCommand = commands.find((entry) => entry.command === "upgrade");
    const restartCommand = commands.find((entry) => entry.command === "restart");
    if (!upgradeCommand || !restartCommand) {
      throw new Error("Expected upgrade and restart commands to be registered");
    }
    const descriptor = {
      type: "user",
      connector: "telegram",
      channelId: "123",
      userId: "123"
    };
    const context = { messageId: "56" };

    await upgradeCommand.handler("/upgrade", context, descriptor);
    await restartCommand.handler("/restart", context, descriptor);

    expect(registrar.sendMessage).toHaveBeenCalledWith(
      descriptor,
      context,
      { text: "Upgrading Daycare..." }
    );
    expect(registrar.sendMessage).toHaveBeenCalledWith(
      descriptor,
      context,
      { text: "Restarting Daycare..." }
    );
    expect(upgradeRun).toHaveBeenCalledWith(
      expect.objectContaining({
        strategy: "pm2",
        processName: "daycare",
        sendStatus: expect.any(Function)
      })
    );
    expect(upgradeRestartRun).toHaveBeenCalledWith(
      expect.objectContaining({
        strategy: "pm2",
        processName: "daycare",
        sendStatus: expect.any(Function)
      })
    );
    expect(upgradeRestartPendingSet).toHaveBeenCalledWith(
      expect.objectContaining({
        dataDir: "/tmp/daycare",
        descriptor,
        context
      })
    );
    expect(upgradeRestartPendingClear).not.toHaveBeenCalled();
  });

  it("clears pending restart marker when restart command fails", async () => {
    vi.mocked(upgradeRestartRun).mockRejectedValue(new Error("pm2 failed"));
    const registrar = {
      registerCommand: vi.fn(),
      unregisterCommand: vi.fn(),
      sendMessage: vi.fn(async () => undefined)
    };
    const api = {
      instance: { instanceId: "upgrade", pluginId: "upgrade" },
      settings: { strategy: "pm2", processName: "daycare" },
      engineSettings: {},
      logger: { warn: vi.fn() },
      auth: {},
      dataDir: "/tmp/daycare",
      registrar,
      exposes: {
        registerProvider: async () => undefined,
        unregisterProvider: async () => undefined,
        listProviders: () => []
      },
      fileStore: {},
      inference: { complete: async () => undefined },
      processes: {},
      mode: "runtime",
      events: { emit: () => undefined }
    };
    const instance = await plugin.create(api as never);
    await instance.load?.();
    const commands = registrar.registerCommand.mock.calls.map(
      (call) => call[0] as { command: string; handler: (...args: unknown[]) => Promise<void> }
    );
    const restartCommand = commands.find((entry) => entry.command === "restart");
    if (!restartCommand) {
      throw new Error("Expected restart command to be registered");
    }
    const descriptor = {
      type: "user",
      connector: "telegram",
      channelId: "123",
      userId: "123"
    };
    const context = { messageId: "56" };

    await restartCommand.handler("/restart", context, descriptor);

    expect(upgradeRestartPendingClear).toHaveBeenCalledWith("/tmp/daycare");
  });

  it("sends restart completion from postStart when a recent marker exists", async () => {
    vi.mocked(upgradeRestartPendingTake).mockResolvedValue({
      descriptor: {
        type: "user",
        connector: "telegram",
        channelId: "123",
        userId: "123"
      },
      context: { messageId: "77" },
      requestedAtMs: Date.now(),
      requesterPid: process.pid - 1
    });
    const registrar = {
      registerCommand: vi.fn(),
      unregisterCommand: vi.fn(),
      sendMessage: vi.fn(async () => undefined)
    };
    const api = {
      instance: { instanceId: "upgrade", pluginId: "upgrade" },
      settings: { strategy: "pm2", processName: "daycare" },
      engineSettings: {},
      logger: { warn: vi.fn() },
      auth: {},
      dataDir: "/tmp/daycare",
      registrar,
      exposes: {
        registerProvider: async () => undefined,
        unregisterProvider: async () => undefined,
        listProviders: () => []
      },
      fileStore: {},
      inference: { complete: async () => undefined },
      processes: {},
      mode: "runtime",
      events: { emit: () => undefined }
    };
    const instance = await plugin.create(api as never);

    await instance.postStart?.();

    expect(registrar.sendMessage).toHaveBeenCalledWith(
      {
        type: "user",
        connector: "telegram",
        channelId: "123",
        userId: "123"
      },
      { messageId: "77" },
      { text: "Restart complete. Daycare is back online." }
    );
  });
});
