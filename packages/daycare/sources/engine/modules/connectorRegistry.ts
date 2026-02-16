import { getLogger } from "../../log.js";
import { CommandRegistry } from "./commandRegistry.js";
import type {
  Connector,
  ConnectorMessage,
  MessageContext,
  MessageHandler,
  CommandHandler,
  CommandUnsubscribe,
  MessageUnsubscribe,
  SlashCommandEntry,
  PermissionDecision,
  PermissionHandler
} from "./connectors/types.js";
import type { AgentDescriptor } from "@/types";

export type ConnectorActionResult =
  | { ok: true; status: "loaded" | "already-loaded" | "unloaded" | "not-loaded" }
  | { ok: false; status: "error"; message: string };

export type ConnectorRegistryOptions = {
  commandRegistry?: CommandRegistry;
  onMessage: (
    message: ConnectorMessage,
    context: MessageContext,
    descriptor: AgentDescriptor
  ) => void | Promise<void>;
  onCommand?: (
    command: string,
    context: MessageContext,
    descriptor: AgentDescriptor
  ) => void | Promise<void>;
  onPermission?: (
    decision: PermissionDecision,
    context: MessageContext,
    descriptor: AgentDescriptor
  ) => void | Promise<void>;
  onFatal?: (source: string, reason: string, error?: unknown) => void;
};

const CORE_COMMANDS: SlashCommandEntry[] = [
  { command: "reset", description: "Reset the current conversation." },
  { command: "context", description: "Show latest context token usage." },
  { command: "compaction", description: "Compact the current conversation." },
  { command: "abort", description: "Abort the current inference." }
];

type ManagedConnector = {
  connector: Connector;
  unsubscribe?: MessageUnsubscribe;
  commandUnsubscribe?: CommandUnsubscribe;
  permissionUnsubscribe?: MessageUnsubscribe;
  loadedAt: Date;
};

export class ConnectorRegistry {
  private connectors = new Map<string, ManagedConnector>();
  private commandRegistry: CommandRegistry;
  private onMessage: ConnectorRegistryOptions["onMessage"];
  private onCommand?: ConnectorRegistryOptions["onCommand"];
  private onPermission?: ConnectorRegistryOptions["onPermission"];
  private onFatal?: ConnectorRegistryOptions["onFatal"];
  private logger = getLogger("connectors.registry");

  constructor(options: ConnectorRegistryOptions) {
    this.commandRegistry = options.commandRegistry ?? new CommandRegistry();
    this.onMessage = options.onMessage;
    this.onCommand = options.onCommand;
    this.onPermission = options.onPermission;
    this.onFatal = options.onFatal;
    this.commandRegistry.onChange(() => {
      void this.updateCommandsForAllConnectors();
    });
    this.logger.debug("init: ConnectorRegistry initialized");
  }

  list(): string[] {
    return Array.from(this.connectors.keys());
  }

  listStatus(): Array<{ id: string; loadedAt: Date }> {
    return Array.from(this.connectors.entries()).map(([id, entry]) => ({
      id,
      loadedAt: entry.loadedAt
    }));
  }

  has(id: string): boolean {
    return this.connectors.has(id);
  }

  get(id: string): Connector | null {
    return this.connectors.get(id)?.connector ?? null;
  }

  register(id: string, connector: Connector): ConnectorActionResult {
    this.logger.debug(`register: register() called connectorId=${id}`);
    if (this.connectors.has(id)) {
      this.logger.debug(`register: Connector already registered connectorId=${id}`);
      return { ok: true, status: "already-loaded" };
    }

    this.logger.debug(`event: Attaching message handler connectorId=${id}`);
    const unsubscribe = this.attach(id, connector);
    const commandUnsubscribe = this.attachCommand(id, connector);
    const permissionUnsubscribe = this.attachPermission(id, connector);
    this.connectors.set(id, {
      connector,
      unsubscribe,
      commandUnsubscribe,
      permissionUnsubscribe,
      loadedAt: new Date()
    });
    void this.updateCommandsForConnector(id, connector);
    this.logger.debug(`event: Connector added to registry connectorId=${id} totalConnectors=${this.connectors.size}`);
    this.logger.info({ connector: id }, "register: Connector registered");
    return { ok: true, status: "loaded" };
  }

  async unregister(id: string, reason = "unload"): Promise<ConnectorActionResult> {
    this.logger.debug(`unregister: unregister() called connectorId=${id} reason=${reason}`);
    const entry = this.connectors.get(id);
    if (!entry) {
      this.logger.debug(`event: Connector not found connectorId=${id}`);
      return { ok: true, status: "not-loaded" };
    }

    this.logger.debug(`event: Unsubscribing message handler connectorId=${id}`);
    entry.unsubscribe?.();
    entry.commandUnsubscribe?.();
    entry.permissionUnsubscribe?.();
    try {
      this.logger.debug(`event: Calling connector.shutdown() connectorId=${id} reason=${reason}`);
      await entry.connector.shutdown?.(reason);
      this.logger.debug(`event: Connector shutdown complete connectorId=${id}`);
    } catch (error) {
      this.logger.warn({ connector: id, error }, "error: Connector shutdown failed");
    }
    this.connectors.delete(id);
    this.logger.debug(`event: Connector removed from registry connectorId=${id} remainingConnectors=${this.connectors.size}`);
    this.logger.info({ connector: id }, "unregister: Connector unregistered");
    return { ok: true, status: "unloaded" };
  }

  async unregisterAll(reason = "shutdown"): Promise<void> {
    const ids = Array.from(this.connectors.keys());
    this.logger.debug(`start: unregisterAll() starting count=${ids.length} ids=${ids.join(",")} reason=${reason}`);
    for (const id of ids) {
      await this.unregister(id, reason);
    }
    this.logger.debug("event: unregisterAll() complete");
  }

  reportFatal(id: string, reason: string, error?: unknown): void {
    this.onFatal?.(id, reason, error);
  }

  private attach(id: string, connector: Connector): MessageUnsubscribe {
    const handler: MessageHandler = (message, context, descriptor) => {
      return this.onMessage(message, context, descriptor);
    };
    return connector.onMessage(handler);
  }

  private attachCommand(id: string, connector: Connector): CommandUnsubscribe | undefined {
    if (!this.onCommand || !connector.onCommand) {
      return undefined;
    }
    const handler: CommandHandler = (command, context, descriptor) => {
      return this.onCommand?.(command, context, descriptor);
    };
    return connector.onCommand(handler);
  }

  private attachPermission(id: string, connector: Connector): MessageUnsubscribe | undefined {
    if (!this.onPermission || !connector.onPermission) {
      return undefined;
    }
    const handler: PermissionHandler = (decision, context, descriptor) => {
      return this.onPermission?.(decision, context, descriptor);
    };
    return connector.onPermission(handler);
  }

  private commandListBuild(): SlashCommandEntry[] {
    const commandByName = new Map<string, SlashCommandEntry>();
    for (const command of CORE_COMMANDS) {
      commandByName.set(command.command, command);
    }
    for (const command of this.commandRegistry.list()) {
      commandByName.set(command.command, command);
    }
    return Array.from(commandByName.values());
  }

  private async updateCommandsForAllConnectors(): Promise<void> {
    for (const [id, entry] of this.connectors.entries()) {
      await this.updateCommandsForConnector(id, entry.connector);
    }
  }

  private async updateCommandsForConnector(id: string, connector: Connector): Promise<void> {
    if (!connector.updateCommands) {
      return;
    }
    const commands = this.commandListBuild();
    try {
      await connector.updateCommands(commands);
    } catch (error) {
      this.logger.warn(
        { connector: id, error },
        "error: Connector updateCommands() failed"
      );
    }
  }
}
