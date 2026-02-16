import { describe, expect, it, vi } from "vitest";

import type { Connector } from "@/types";
import { CommandRegistry } from "./commandRegistry.js";
import { ConnectorRegistry } from "./connectorRegistry.js";

describe("ConnectorRegistry command updates", () => {
  it("pushes merged core and plugin commands to connectors", async () => {
    const commandRegistry = new CommandRegistry();
    const connectorRegistry = new ConnectorRegistry({
      commandRegistry,
      onMessage: async () => undefined
    });

    const updateCommands = vi.fn(async () => undefined);
    const connector: Connector = {
      capabilities: { sendText: true },
      onMessage: () => () => undefined,
      sendMessage: async () => undefined,
      updateCommands
    };

    connectorRegistry.register("telegram", connector);
    await Promise.resolve();

    expect(updateCommands).toHaveBeenCalledTimes(1);
    expect(updateCommands).toHaveBeenLastCalledWith([
      { command: "reset", description: "Reset the current conversation." },
      { command: "context", description: "Show latest context token usage." },
      { command: "compaction", description: "Compact the current conversation." },
      { command: "stop", description: "Abort the current inference." },
      { command: "abort", description: "Abort the current inference." }
    ]);

    commandRegistry.register("upgrade", {
      command: "upgrade",
      description: "Upgrade daycare to latest version",
      handler: async () => undefined
    });
    await Promise.resolve();

    expect(updateCommands).toHaveBeenCalledTimes(2);
    expect(updateCommands).toHaveBeenLastCalledWith([
      { command: "reset", description: "Reset the current conversation." },
      { command: "context", description: "Show latest context token usage." },
      { command: "compaction", description: "Compact the current conversation." },
      { command: "stop", description: "Abort the current inference." },
      { command: "abort", description: "Abort the current inference." },
      { command: "upgrade", description: "Upgrade daycare to latest version" }
    ]);
  });

  it("updates newly registered connectors with current command state", async () => {
    const commandRegistry = new CommandRegistry();
    commandRegistry.register("upgrade", {
      command: "upgrade",
      description: "Upgrade daycare to latest version",
      handler: async () => undefined
    });

    const connectorRegistry = new ConnectorRegistry({
      commandRegistry,
      onMessage: async () => undefined
    });

    const updateCommands = vi.fn(async () => undefined);
    const connector: Connector = {
      capabilities: { sendText: true },
      onMessage: () => () => undefined,
      sendMessage: async () => undefined,
      updateCommands
    };

    connectorRegistry.register("telegram", connector);
    await Promise.resolve();

    expect(updateCommands).toHaveBeenCalledTimes(1);
    expect(updateCommands).toHaveBeenLastCalledWith([
      { command: "reset", description: "Reset the current conversation." },
      { command: "context", description: "Show latest context token usage." },
      { command: "compaction", description: "Compact the current conversation." },
      { command: "stop", description: "Abort the current inference." },
      { command: "abort", description: "Abort the current inference." },
      { command: "upgrade", description: "Upgrade daycare to latest version" }
    ]);
  });
});
