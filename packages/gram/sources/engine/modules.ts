import type { ToolCall, ToolResultMessage, Tool } from "@mariozechner/pi-ai";
import { validateToolCall } from "@mariozechner/pi-ai";

import { getLogger } from "../log.js";
import type {
  Connector,
  ConnectorMessage,
  MessageContext,
  MessageHandler,
  MessageUnsubscribe,
  PermissionDecision,
  PermissionHandler
} from "./connectors/types.js";
import type { InferenceProvider } from "./inference/types.js";
import type { ImageGenerationProvider } from "./images/types.js";
import type { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from "./tools/types.js";

export type ConnectorActionResult =
  | { ok: true; status: "loaded" | "already-loaded" | "unloaded" | "not-loaded" }
  | { ok: false; status: "error"; message: string };

export type ConnectorRegistryOptions = {
  onMessage: (
    source: string,
    message: ConnectorMessage,
    context: MessageContext
  ) => void | Promise<void>;
  onPermission?: (
    source: string,
    decision: PermissionDecision,
    context: MessageContext
  ) => void | Promise<void>;
  onFatal?: (source: string, reason: string, error?: unknown) => void;
};

type ManagedConnector = {
  connector: Connector;
  unsubscribe?: MessageUnsubscribe;
  permissionUnsubscribe?: MessageUnsubscribe;
  loadedAt: Date;
};

type RegisteredInferenceProvider = InferenceProvider & { pluginId: string };

type RegisteredImageProvider = ImageGenerationProvider & { pluginId: string };

type RegisteredTool = ToolDefinition & { pluginId: string };

const logger = getLogger("engine.modules");

export class ConnectorRegistry {
  private connectors = new Map<string, ManagedConnector>();
  private onMessage: ConnectorRegistryOptions["onMessage"];
  private onPermission?: ConnectorRegistryOptions["onPermission"];
  private onFatal?: ConnectorRegistryOptions["onFatal"];
  private logger = getLogger("connectors.registry");

  constructor(options: ConnectorRegistryOptions) {
    this.onMessage = options.onMessage;
    this.onPermission = options.onPermission;
    this.onFatal = options.onFatal;
    this.logger.debug("ConnectorRegistry initialized");
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
    this.logger.debug(`register() called connectorId=${id}`);
    if (this.connectors.has(id)) {
      this.logger.debug(`Connector already registered connectorId=${id}`);
      return { ok: true, status: "already-loaded" };
    }

    this.logger.debug(`Attaching message handler connectorId=${id}`);
    const unsubscribe = this.attach(id, connector);
    const permissionUnsubscribe = this.attachPermission(id, connector);
    this.connectors.set(id, {
      connector,
      unsubscribe,
      permissionUnsubscribe,
      loadedAt: new Date()
    });
    this.logger.debug(`Connector added to registry connectorId=${id} totalConnectors=${this.connectors.size}`);
    this.logger.info({ connector: id }, "Connector registered");
    return { ok: true, status: "loaded" };
  }

  async unregister(id: string, reason = "unload"): Promise<ConnectorActionResult> {
    this.logger.debug(`unregister() called connectorId=${id} reason=${reason}`);
    const entry = this.connectors.get(id);
    if (!entry) {
      this.logger.debug(`Connector not found connectorId=${id}`);
      return { ok: true, status: "not-loaded" };
    }

    this.logger.debug(`Unsubscribing message handler connectorId=${id}`);
    entry.unsubscribe?.();
    entry.permissionUnsubscribe?.();
    try {
      this.logger.debug(`Calling connector.shutdown() connectorId=${id} reason=${reason}`);
      await entry.connector.shutdown?.(reason);
      this.logger.debug(`Connector shutdown complete connectorId=${id}`);
    } catch (error) {
      this.logger.warn({ connector: id, error }, "Connector shutdown failed");
    }
    this.connectors.delete(id);
    this.logger.debug(`Connector removed from registry connectorId=${id} remainingConnectors=${this.connectors.size}`);
    this.logger.info({ connector: id }, "Connector unregistered");
    return { ok: true, status: "unloaded" };
  }

  async unregisterAll(reason = "shutdown"): Promise<void> {
    const ids = Array.from(this.connectors.keys());
    this.logger.debug(`unregisterAll() starting count=${ids.length} ids=${ids.join(",")} reason=${reason}`);
    for (const id of ids) {
      await this.unregister(id, reason);
    }
    this.logger.debug("unregisterAll() complete");
  }

  reportFatal(id: string, reason: string, error?: unknown): void {
    this.onFatal?.(id, reason, error);
  }

  private attach(id: string, connector: Connector): MessageUnsubscribe {
    const handler: MessageHandler = (message, context) => {
      return this.onMessage(id, message, context);
    };
    return connector.onMessage(handler);
  }

  private attachPermission(id: string, connector: Connector): MessageUnsubscribe | undefined {
    if (!this.onPermission || !connector.onPermission) {
      return undefined;
    }
    const handler: PermissionHandler = (decision, context) => {
      return this.onPermission?.(id, decision, context);
    };
    return connector.onPermission(handler);
  }
}

export class InferenceRegistry {
  private providers = new Map<string, RegisteredInferenceProvider>();
  private logger = getLogger("inference.registry");

  register(pluginId: string, provider: InferenceProvider): void {
    this.logger.debug(`Registering inference provider pluginId=${pluginId} providerId=${provider.id} label=${provider.label}`);
    this.providers.set(provider.id, { ...provider, pluginId });
    this.logger.debug(`Inference provider registered totalProviders=${this.providers.size}`);
  }

  unregister(id: string): void {
    this.logger.debug(`Unregistering inference provider providerId=${id}`);
    this.providers.delete(id);
  }

  unregisterByPlugin(pluginId: string): void {
    this.logger.debug(`Unregistering inference providers by plugin pluginId=${pluginId}`);
    let count = 0;
    for (const [id, entry] of this.providers.entries()) {
      if (entry.pluginId === pluginId) {
        this.providers.delete(id);
        count++;
      }
    }
    this.logger.debug(`Inference providers unregistered by plugin pluginId=${pluginId} unregisteredCount=${count}`);
  }

  get(id: string): InferenceProvider | null {
    const provider = this.providers.get(id) ?? null;
    this.logger.debug(`get() inference provider providerId=${id} found=${!!provider}`);
    return provider;
  }

  list(): InferenceProvider[] {
    return Array.from(this.providers.values());
  }
}

export class ImageGenerationRegistry {
  private providers = new Map<string, RegisteredImageProvider>();
  private logger = getLogger("image.registry");

  register(pluginId: string, provider: ImageGenerationProvider): void {
    this.logger.debug(`Registering image provider pluginId=${pluginId} providerId=${provider.id} label=${provider.label}`);
    this.providers.set(provider.id, { ...provider, pluginId });
    this.logger.debug(`Image provider registered totalProviders=${this.providers.size}`);
  }

  unregister(id: string): void {
    this.logger.debug(`Unregistering image provider providerId=${id}`);
    this.providers.delete(id);
  }

  unregisterByPlugin(pluginId: string): void {
    this.logger.debug(`Unregistering image providers by plugin pluginId=${pluginId}`);
    let count = 0;
    for (const [id, entry] of this.providers.entries()) {
      if (entry.pluginId === pluginId) {
        this.providers.delete(id);
        count++;
      }
    }
    this.logger.debug(`Image providers unregistered by plugin pluginId=${pluginId} unregisteredCount=${count}`);
  }

  get(id: string): ImageGenerationProvider | null {
    return this.providers.get(id) ?? null;
  }

  list(): ImageGenerationProvider[] {
    return Array.from(this.providers.values());
  }
}

export class ToolResolver {
  private tools = new Map<string, RegisteredTool>();

  register(pluginId: string, definition: ToolDefinition): void {
    logger.debug(`Registering tool pluginId=${pluginId} toolName=${definition.tool.name}`);
    this.tools.set(definition.tool.name, { ...definition, pluginId });
    logger.debug(`Tool registered totalTools=${this.tools.size}`);
  }

  unregister(name: string): void {
    logger.debug(`Unregistering tool toolName=${name}`);
    this.tools.delete(name);
  }

  unregisterByPlugin(pluginId: string): void {
    logger.debug(`Unregistering tools by plugin pluginId=${pluginId}`);
    let count = 0;
    for (const [name, entry] of this.tools.entries()) {
      if (entry.pluginId === pluginId) {
        this.tools.delete(name);
        count++;
      }
    }
    logger.debug(`Tools unregistered by plugin pluginId=${pluginId} unregisteredCount=${count}`);
  }

  listTools(): Tool[] {
    return Array.from(this.tools.values()).map((entry) => entry.tool);
  }

  async execute(
    toolCall: ToolCall,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const argsPreview = JSON.stringify(toolCall.arguments).slice(0, 100);
    logger.debug(`execute() called toolName=${toolCall.name} toolCallId=${toolCall.id} argsPreview=${argsPreview}`);
    const entry = this.tools.get(toolCall.name);
    if (!entry) {
      const availableTools = Array.from(this.tools.keys()).join(",");
      logger.debug(`Tool not found toolName=${toolCall.name} availableTools=${availableTools}`);
      return {
        toolMessage: buildToolError(toolCall, `Unknown tool: ${toolCall.name}`)
      };
    }

    try {
      logger.debug(`Validating tool call arguments toolName=${toolCall.name}`);
      const args = validateToolCall([entry.tool], toolCall);
      logger.debug(`Arguments validated, executing tool toolName=${toolCall.name}`);
      const startTime = Date.now();
      const result = await entry.execute(args, context, toolCall);
      const duration = Date.now() - startTime;
      logger.debug(`Tool execution completed toolName=${toolCall.name} durationMs=${duration} isError=${result.toolMessage.isError} fileCount=${result.files?.length ?? 0}`);
      if (!result.toolMessage.toolCallId) {
        result.toolMessage.toolCallId = toolCall.id;
      }
      if (!result.toolMessage.toolName) {
        result.toolMessage.toolName = toolCall.name;
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool execution failed.";
      logger.debug(`Tool execution threw error toolName=${toolCall.name} error=${String(error)}`);
      logger.warn({ tool: toolCall.name, error }, "Tool execution failed");
      return { toolMessage: buildToolError(toolCall, message) };
    }
  }
}

function buildToolError(toolCall: ToolCall, text: string): ToolResultMessage {
  return {
    role: "toolResult",
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    content: [{ type: "text", text }],
    isError: true,
    timestamp: Date.now()
  };
}
