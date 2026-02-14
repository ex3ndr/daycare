import { getLogger } from "../log.js";
import { AgentSystem } from "./agents/agentSystem.js";
import { ModuleRegistry } from "./modules/moduleRegistry.js";
import type { AgentDescriptor, AgentTokenEntry, Config, MessageContext } from "@/types";
import { FileStore } from "../files/store.js";
import { InferenceRouter } from "./modules/inference/router.js";
import { PluginRegistry } from "./plugins/registry.js";
import { PluginManager } from "./plugins/manager.js";
import { buildPluginCatalog } from "./plugins/catalog.js";
import { ensureWorkspaceDir } from "./permissions.js";
import { getProviderDefinition } from "../providers/catalog.js";
import { AuthStore } from "../auth/store.js";
import {
  buildCronDeleteTaskTool,
  buildCronReadTaskTool,
  buildCronReadMemoryTool,
  buildCronTool,
  buildCronWriteMemoryTool
} from "./modules/tools/cron.js";
import { buildImageGenerationTool } from "./modules/tools/image-generation.js";
import { buildMermaidPngTool } from "./modules/tools/mermaid-png.js";
import { buildReactionTool } from "./modules/tools/reaction.js";
import { buildPermissionGrantTool, buildPermissionRequestTool } from "./modules/tools/permissions.js";
import { buildSendFileTool } from "./modules/tools/send-file.js";
import { buildSignalGenerateTool } from "./modules/tools/signal.js";
import { buildSignalSubscribeTool } from "./modules/tools/signalSubscribeToolBuild.js";
import { buildSignalUnsubscribeTool } from "./modules/tools/signalUnsubscribeToolBuild.js";
import { sessionHistoryToolBuild } from "./modules/tools/sessionHistoryToolBuild.js";
import { permanentAgentToolBuild } from "./modules/tools/permanentAgentToolBuild.js";
import { channelCreateToolBuild } from "./modules/tools/channelCreateTool.js";
import { channelSendToolBuild } from "./modules/tools/channelSendTool.js";
import { channelHistoryToolBuild } from "./modules/tools/channelHistoryTool.js";
import {
  channelAddMemberToolBuild,
  channelRemoveMemberToolBuild
} from "./modules/tools/channelMemberTool.js";
import {
  buildHeartbeatAddTool,
  buildHeartbeatRemoveTool,
  buildHeartbeatRunTool
} from "./modules/tools/heartbeat.js";
import { buildSendAgentMessageTool, buildStartBackgroundAgentTool } from "./modules/tools/background.js";
import { topologyToolBuild } from "./modules/tools/topologyToolBuild.js";
import { Crons } from "./cron/crons.js";
import { Heartbeats } from "./heartbeat/heartbeats.js";
import { toolListContextBuild } from "./modules/tools/toolListContextBuild.js";
import { EngineEventBus } from "./ipc/events.js";
import { ProviderManager } from "../providers/manager.js";
import { agentDescriptorLabel } from "./agents/ops/agentDescriptorLabel.js";
import { agentDescriptorTargetResolve } from "./agents/ops/agentDescriptorTargetResolve.js";
import { permissionDescribeDecision } from "./permissions/permissionDescribeDecision.js";
import { InvalidateSync } from "../util/sync.js";
import { valueDeepEqual } from "../util/valueDeepEqual.js";
import { configLoad } from "../config/configLoad.js";
import { ConfigModule } from "./config/configModule.js";
import { Signals } from "./signals/signals.js";
import { DelayedSignals } from "./signals/delayedSignals.js";
import { Processes } from "./processes/processes.js";
import { IncomingMessages } from "./messages/incomingMessages.js";
import { PermissionRequestRegistry } from "./modules/tools/permissionRequestRegistry.js";
import { Channels } from "./channels/channels.js";

const logger = getLogger("engine.runtime");
const INCOMING_MESSAGES_DEBOUNCE_MS = 100;

export type EngineOptions = {
  config: Config;
  eventBus: EngineEventBus;
};

export class Engine {
  readonly config: ConfigModule;
  readonly authStore: AuthStore;
  readonly fileStore: FileStore;
  readonly modules: ModuleRegistry;
  readonly pluginRegistry: PluginRegistry;
  readonly pluginManager: PluginManager;
  readonly providerManager: ProviderManager;
  readonly agentSystem: AgentSystem;
  readonly crons: Crons;
  readonly heartbeats: Heartbeats;
  readonly signals: Signals;
  readonly delayedSignals: DelayedSignals;
  readonly channels: Channels;
  readonly processes: Processes;
  readonly inferenceRouter: InferenceRouter;
  readonly eventBus: EngineEventBus;
  readonly permissionRequestRegistry: PermissionRequestRegistry;
  private readonly reloadSync: InvalidateSync;
  private readonly incomingMessages: IncomingMessages;

  constructor(options: EngineOptions) {
    logger.debug(`init: Engine constructor starting, dataDir=${options.config.dataDir}`);
    this.config = new ConfigModule(options.config);
    this.eventBus = options.eventBus;
    this.signals = new Signals({
      eventBus: this.eventBus,
      configDir: this.config.current.configDir,
      onDeliver: async (signal, subscriptions) => {
        await this.agentSystem.signalDeliver(signal, subscriptions);
      }
    });
    this.delayedSignals = new DelayedSignals({
      config: this.config,
      eventBus: this.eventBus,
      signals: this.signals
    });
    this.reloadSync = new InvalidateSync(async () => {
      await this.reloadApplyLatest();
    });
    this.permissionRequestRegistry = new PermissionRequestRegistry();
    this.authStore = new AuthStore(this.config.current);
    this.fileStore = new FileStore(this.config.current);
    this.processes = new Processes(
      this.config.current.dataDir,
      getLogger("engine.processes"),
      { socketPath: this.config.current.socketPath }
    );
    this.incomingMessages = new IncomingMessages({
      delayMs: INCOMING_MESSAGES_DEBOUNCE_MS,
      onFlush: async (items) => {
        await this.runConnectorCallback("message", async () => {
          for (const item of items) {
            const connector = item.descriptor.type === "user" ? item.descriptor.connector : "unknown";
            logger.debug(
              `receive: Connector message received: connector=${connector} type=${item.descriptor.type} merged=${item.count} text=${item.message.text?.length ?? 0}chars files=${item.message.files?.length ?? 0}`
            );
            await this.agentSystem.post(
              { descriptor: item.descriptor },
              { type: "message", message: item.message, context: item.context }
            );
          }
        });
      }
    });
    logger.debug(`init: AuthStore and FileStore initialized`);

    this.modules = new ModuleRegistry({
      onMessage: async (message, context, descriptor) => {
        this.incomingMessages.post({ descriptor, message, context });
      },
      onCommand: async (command, context, descriptor) => this.runConnectorCallback("command", async () => {
        const connector = descriptor.type === "user" ? descriptor.connector : "unknown";
        const parsed = parseCommand(command);
        if (!parsed) {
          return;
        }
        if (parsed.name === "reset") {
          if (descriptor.type !== "user") {
            return;
          }
          logger.info(
            { connector, channelId: descriptor.channelId, userId: descriptor.userId },
            "receive: Reset command received"
          );
          await this.handleResetCommand(descriptor, context);
          return;
        }
        if (parsed.name === "context") {
          if (descriptor.type !== "user") {
            return;
          }
          logger.info(
            { connector, channelId: descriptor.channelId, userId: descriptor.userId },
            "receive: Context command received"
          );
          await this.handleContextCommand(descriptor, context);
          return;
        }
        if (parsed.name === "stop") {
          if (descriptor.type !== "user") {
            return;
          }
          logger.info(
            { connector, channelId: descriptor.channelId, userId: descriptor.userId },
            "stop: Stop command received"
          );
          await this.handleStopCommand(descriptor, context);
          return;
        }
        logger.debug({ connector, command: parsed.name }, "event: Unknown command ignored");
      }),
      onPermission: async (decision, context, descriptor) => this.runConnectorCallback("permission", async () => {
        const resolved = this.permissionRequestRegistry.resolve(decision.token, decision);
        if (!resolved) {
          logger.warn(
            { token: decision.token, agentId: decision.agentId },
            "event: Permission decision dropped; no pending request"
          );
        }

        if (decision.agentId) {
          const requester = this.agentSystem.getAgentDescriptor(decision.agentId);
          if (!requester || requester.type !== "user") {
            const status = decision.approved ? "approved" : "denied";
            const permissionLabel = permissionDescribeDecision(decision.access);
            const agentLabel = requester ? agentDescriptorLabel(requester) : "agent";
            const notice = [
              `User ${status} ${permissionLabel} for background agent "${agentLabel}".`,
              "Decision delivered to background agent."
            ].join("\n");
            await this.agentSystem.post(
              { descriptor },
              {
                type: "system_message",
                text: notice,
                origin: decision.agentId,
                context,
                silent: true
              }
            );
          }
        }
      }),
      onFatal: (source, reason, error) => {
        logger.warn({ source, reason, error }, "event: Connector requested shutdown");
      }
    });

    this.inferenceRouter = new InferenceRouter({
      registry: this.modules.inference,
      auth: this.authStore,
      // Hold read lock for the full inference lifecycle so write-locked reload reaches
      // a strict quiescent point with no active model calls.
      config: this.config
    });

    this.pluginRegistry = new PluginRegistry(this.modules);

    this.pluginManager = new PluginManager({
      config: this.config,
      registry: this.pluginRegistry,
      auth: this.authStore,
      fileStore: this.fileStore,
      pluginCatalog: buildPluginCatalog(),
      inferenceRouter: this.inferenceRouter,
      processes: this.processes,
      engineEvents: this.eventBus,
      onEvent: (event) => {
        this.agentSystem.eventBus.emit("plugin.event", event);
      }
    });

    this.providerManager = new ProviderManager({
      config: this.config,
      auth: this.authStore,
      fileStore: this.fileStore,
      inferenceRegistry: this.modules.inference,
      imageRegistry: this.modules.images
    });

    this.agentSystem = new AgentSystem({
      config: this.config,
      eventBus: this.eventBus,
      connectorRegistry: this.modules.connectors,
      imageRegistry: this.modules.images,
      toolResolver: this.modules.tools,
      pluginManager: this.pluginManager,
      inferenceRouter: this.inferenceRouter,
      fileStore: this.fileStore,
      authStore: this.authStore,
      delayedSignals: this.delayedSignals,
      permissionRequestRegistry: this.permissionRequestRegistry
    });

    this.crons = new Crons({
      config: this.config,
      eventBus: this.eventBus,
      agentSystem: this.agentSystem
    });
    this.agentSystem.setCrons(this.crons);
    this.agentSystem.setSignals(this.signals);

    const heartbeats = new Heartbeats({
      config: this.config,
      eventBus: this.eventBus,
      intervalMs: 30 * 60 * 1000,
      agentSystem: this.agentSystem
    });
    this.heartbeats = heartbeats;
    this.agentSystem.setHeartbeats(heartbeats);
    this.channels = new Channels({
      configDir: this.config.current.configDir,
      signals: this.signals,
      agentSystem: this.agentSystem
    });

  }

  async start(): Promise<void> {
    logger.debug("start: Engine.start() beginning");
    await ensureWorkspaceDir(this.config.current.defaultPermissions.workingDir);

    logger.debug("load: Loading agents");
    await this.agentSystem.load();
    logger.debug("load: Agents loaded");

    logger.debug("reload: Reloading provider manager with current config");
    await this.providerManager.reload();
    logger.debug("reload: Provider manager reload complete");
    logger.debug("load: Loading durable process manager");
    await this.processes.load();
    logger.debug("load: Durable process manager loaded");
    logger.debug("reload: Reloading plugins with current config");
    await this.pluginManager.reload();
    logger.debug("reload: Plugin reload complete");

    await this.crons.ensureDir();
    await this.heartbeats.ensureDir();
    await this.signals.ensureDir();
    await this.delayedSignals.ensureDir();
    await this.channels.ensureDir();
    await this.channels.load();

    logger.debug("register: Registering core tools");
    this.modules.tools.register("core", buildCronTool(this.crons));
    this.modules.tools.register("core", buildCronReadTaskTool(this.crons));
    this.modules.tools.register("core", buildCronReadMemoryTool(this.crons));
    this.modules.tools.register("core", buildCronWriteMemoryTool(this.crons));
    this.modules.tools.register("core", buildCronDeleteTaskTool(this.crons));
    this.modules.tools.register("core", buildHeartbeatRunTool());
    this.modules.tools.register("core", buildHeartbeatAddTool());
    this.modules.tools.register("core", buildHeartbeatRemoveTool());
    this.modules.tools.register("core", buildStartBackgroundAgentTool());
    this.modules.tools.register("core", buildSendAgentMessageTool());
    this.modules.tools.register("core", topologyToolBuild(this.crons, this.signals, this.channels));
    this.modules.tools.register("core", sessionHistoryToolBuild());
    this.modules.tools.register("core", permanentAgentToolBuild());
    this.modules.tools.register("core", channelCreateToolBuild(this.channels));
    this.modules.tools.register("core", channelSendToolBuild(this.channels));
    this.modules.tools.register("core", channelHistoryToolBuild(this.channels));
    this.modules.tools.register("core", channelAddMemberToolBuild(this.channels));
    this.modules.tools.register("core", channelRemoveMemberToolBuild(this.channels));
    this.modules.tools.register("core", buildImageGenerationTool(this.modules.images));
    this.modules.tools.register("core", buildMermaidPngTool());
    this.modules.tools.register("core", buildReactionTool());
    this.modules.tools.register("core", buildSendFileTool());
    this.modules.tools.register("core", buildSignalGenerateTool(this.signals));
    this.modules.tools.register("core", buildSignalSubscribeTool(this.signals));
    this.modules.tools.register("core", buildSignalUnsubscribeTool(this.signals));
    this.modules.tools.register("core", buildPermissionRequestTool());
    this.modules.tools.register("core", buildPermissionGrantTool());
    logger.debug(
      "register: Core tools registered: cron, cron_memory, heartbeat, topology, background, session_history, permanent_agents, channels, image_generation, mermaid_png, reaction, send_file, generate_signal, signal_subscribe, signal_unsubscribe, request_permission, grant_permission"
    );

    logger.debug("start: Starting agent system");
    await this.agentSystem.start();
    logger.debug("start: Agent system started");

    logger.debug("start: Starting cron scheduler");
    await this.crons.start();
    logger.debug("start: Starting heartbeat scheduler");
    await this.heartbeats.start();
    logger.debug("start: Starting delayed signal scheduler");
    await this.delayedSignals.start();
    logger.debug("start: Engine.start() complete");
  }

  async shutdown(): Promise<void> {
    this.reloadSync.stop();
    await this.modules.connectors.unregisterAll("shutdown");
    await this.incomingMessages.flush();
    this.crons.stop();
    this.heartbeats.stop();
    this.delayedSignals.stop();
    this.processes.unload();
    await this.pluginManager.unloadAll();
  }

  getStatus() {
    const plugins = this.pluginManager.listLoadedDetails();
    const pluginByInstance = new Map(plugins.map((plugin) => [plugin.id, plugin]));

    return {
      plugins,
      providers: this.providerManager.listLoadedDetails(),
      connectors: this.modules.connectors.listStatus().map((connector) => {
        const plugin = pluginByInstance.get(connector.id);
        return {
          id: connector.id,
          name: plugin?.name ?? connector.id,
          pluginId: plugin?.pluginId,
          loadedAt: connector.loadedAt
        };
      }),
      inferenceProviders: this.modules.inference.list().map((provider) => {
        const definition = getProviderDefinition(provider.id);
        return {
          id: provider.id,
          name: provider.label ?? definition?.name ?? provider.id,
          label: provider.label
        };
      }),
      imageProviders: this.modules.images.list().map((provider) => {
        const definition = getProviderDefinition(provider.id);
        return {
          id: provider.id,
          name: provider.label ?? definition?.name ?? provider.id,
          label: provider.label
        };
      }),
      tools: this.listContextTools().map((tool) => tool.name)
    };
  }

  private listContextTools(
    source?: string,
    options?: { agentKind?: "background" | "foreground"; allowCronTools?: boolean }
  ) {
    return toolListContextBuild({
      tools: this.modules.tools.listTools(),
      source,
      agentKind: options?.agentKind,
      allowCronTools: options?.allowCronTools,
      connectorRegistry: this.modules.connectors,
      imageRegistry: this.modules.images
    });
  }

  private async handleContextCommand(
    descriptor: AgentDescriptor,
    context: MessageContext
  ): Promise<void> {
    const target = agentDescriptorTargetResolve(descriptor);
    if (!target) {
      return;
    }
    const connector = this.modules.connectors.get(target.connector);
    if (!connector?.capabilities.sendText) {
      return;
    }
    let tokens: AgentTokenEntry | null = null;
    try {
      tokens = await this.agentSystem.tokensForTarget({ descriptor });
    } catch (error) {
      logger.warn({ connector: target.connector, error }, "error: Context command failed to load tokens");
    }
    const text = contextCommandTextBuild(tokens);
    try {
      await connector.sendMessage(target.targetId, {
        text,
        replyToMessageId: context.messageId
      });
    } catch (error) {
      logger.warn({ connector: target.connector, error }, "error: Context command failed to send response");
    }
  }

  private async handleResetCommand(
    descriptor: AgentDescriptor,
    context: MessageContext
  ): Promise<void> {
    await this.agentSystem.post(
      { descriptor },
      { type: "reset", message: "Manual reset requested by the user.", context }
    );
  }

  private async handleStopCommand(
    descriptor: AgentDescriptor,
    context: MessageContext
  ): Promise<void> {
    const target = agentDescriptorTargetResolve(descriptor);
    if (!target) {
      return;
    }
    const connector = this.modules.connectors.get(target.connector);
    if (!connector?.capabilities.sendText) {
      return;
    }
    const aborted = this.agentSystem.abortInferenceForTarget({ descriptor });
    const text = aborted
      ? "Stopped current inference."
      : "No active inference to stop.";
    try {
      await connector.sendMessage(target.targetId, {
        text,
        replyToMessageId: context.messageId
      });
    } catch (error) {
      logger.warn({ connector: target.connector, error }, "error: Stop command failed to send response");
    }
  }

  async reload(): Promise<void> {
    await this.reloadSync.invalidateAndAwait();
  }

  private isReloadable(next: Config): boolean {
    return configReloadPathsEqual(this.config.current, next);
  }

  private async inReadLock<T>(operation: () => Promise<T>): Promise<T> {
    return this.config.inReadLock(operation);
  }

  private async runConnectorCallback(
    kind: "message" | "command" | "permission",
    operation: () => Promise<void>
  ): Promise<void> {
    try {
      await this.inReadLock(operation);
    } catch (error) {
      logger.error({ kind, error }, "error: Connector callback failed");
    }
  }

  private async reloadApplyLatest(): Promise<void> {
    const config = await configLoad(this.config.current.settingsPath, { verbose: this.config.current.verbose });
    if (!this.isReloadable(config)) {
      throw new Error("Config reload requires restart (paths changed).");
    }
    if (configReloadEqual(this.config.current, config)) {
      logger.debug("reload: Reload requested but config is unchanged.");
      return;
    }

    await this.config.inWriteLock(async () => {
      const latest = await configLoad(this.config.current.settingsPath, { verbose: this.config.current.verbose });
      if (!this.isReloadable(latest)) {
        throw new Error("Config reload requires restart (paths changed).");
      }
      if (configReloadEqual(this.config.current, latest)) {
        logger.debug("reload: Reload requested but config is unchanged.");
        return;
      }
      this.config.configSet(latest);
      await ensureWorkspaceDir(this.config.current.defaultPermissions.workingDir);
      await this.providerManager.reload();
      await this.pluginManager.reload();
      this.inferenceRouter.reload();
      logger.info("reload: Runtime configuration reloaded");
    });
  }

}

function parseCommand(command: string): { name: string; args: string[] } | null {
  const trimmed = command.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }
  const body = trimmed.slice(1);
  if (!body) {
    return null;
  }
  const parts = body.split(/\s+/);
  const rawName = parts.shift() ?? "";
  const name = rawName.split("@")[0] ?? "";
  if (!name) {
    return null;
  }
  return { name, args: parts };
}

function contextCommandTextBuild(tokens: AgentTokenEntry | null): string {
  if (!tokens) {
    return "Context size unavailable yet. Run a prompt to capture token usage.";
  }
  const { size } = tokens;
  return [
    `Context size (${tokens.provider}/${tokens.model})`,
    `total: ${size.total} tokens`,
    `input: ${size.input} tokens`,
    `output: ${size.output} tokens`,
    `cache read: ${size.cacheRead} tokens`,
    `cache write: ${size.cacheWrite} tokens`
  ].join("\n");
}

/**
 * Compares reloadable runtime config fields.
 * Keep this in sync with `Config` whenever runtime behavior changes.
 */
function configReloadEqual(left: Config, right: Config): boolean {
  return (
    configReloadPathsEqual(left, right) &&
    left.verbose === right.verbose &&
    valueDeepEqual(left.settings, right.settings) &&
    valueDeepEqual(left.defaultPermissions, right.defaultPermissions)
  );
}

function configReloadPathsEqual(left: Config, right: Config): boolean {
  return (
    left.settingsPath === right.settingsPath &&
    left.configDir === right.configDir &&
    left.dataDir === right.dataDir &&
    left.agentsDir === right.agentsDir &&
    left.filesDir === right.filesDir &&
    left.authPath === right.authPath &&
    left.socketPath === right.socketPath &&
    left.workspaceDir === right.workspaceDir
  );
}
