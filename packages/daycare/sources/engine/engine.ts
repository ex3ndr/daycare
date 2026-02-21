import path from "node:path";

import type { AgentDescriptor, AgentTokenEntry, Config, MessageContext } from "@/types";
import { AuthStore } from "../auth/store.js";
import { configLoad } from "../config/configLoad.js";
import { getLogger } from "../log.js";
import { getProviderDefinition } from "../providers/catalog.js";
import { ProviderManager } from "../providers/manager.js";
import { Storage } from "../storage/storage.js";
import { InvalidateSync } from "../util/sync.js";
import { valueDeepEqual } from "../util/valueDeepEqual.js";
import { AgentSystem } from "./agents/agentSystem.js";
import { agentDescriptorTargetResolve } from "./agents/ops/agentDescriptorTargetResolve.js";
import { messageContextStatus } from "./agents/ops/messageContextStatus.js";
import { appInstallToolBuild } from "./apps/appInstallToolBuild.js";
import { Apps } from "./apps/appManager.js";
import { appRuleToolBuild } from "./apps/appRuleToolBuild.js";
import { Channels } from "./channels/channels.js";
import { ConfigModule } from "./config/configModule.js";
import { Crons } from "./cron/crons.js";
import { Exposes } from "./expose/exposes.js";
import { FileFolder } from "./files/fileFolder.js";
import { Heartbeats } from "./heartbeat/heartbeats.js";
import type { EngineEventBus } from "./ipc/events.js";
import { IncomingMessages } from "./messages/incomingMessages.js";
import { InferenceRouter } from "./modules/inference/router.js";
import { ModuleRegistry } from "./modules/moduleRegistry.js";
import { rlmNoToolsModeIs } from "./modules/rlm/rlmNoToolsModeIs.js";
import { rlmToolBuild } from "./modules/rlm/rlmTool.js";
import { agentCompactToolBuild } from "./modules/tools/agentCompactTool.js";
import { agentResetToolBuild } from "./modules/tools/agentResetTool.js";
import { buildSendAgentMessageTool, buildStartBackgroundAgentTool } from "./modules/tools/background.js";
import { channelCreateToolBuild } from "./modules/tools/channelCreateTool.js";
import { channelHistoryToolBuild } from "./modules/tools/channelHistoryTool.js";
import { channelAddMemberToolBuild, channelRemoveMemberToolBuild } from "./modules/tools/channelMemberTool.js";
import { channelSendToolBuild } from "./modules/tools/channelSendTool.js";
import { buildCronDeleteTaskTool, buildCronReadTaskTool, buildCronTool } from "./modules/tools/cron.js";
import { exposeCreateToolBuild } from "./modules/tools/exposeCreateToolBuild.js";
import { exposeListToolBuild } from "./modules/tools/exposeListToolBuild.js";
import { exposeRemoveToolBuild } from "./modules/tools/exposeRemoveToolBuild.js";
import { exposeUpdateToolBuild } from "./modules/tools/exposeUpdateToolBuild.js";
import { buildHeartbeatAddTool, buildHeartbeatRemoveTool, buildHeartbeatRunTool } from "./modules/tools/heartbeat.js";
import { buildImageGenerationTool } from "./modules/tools/image-generation.js";
import { buildMermaidPngTool } from "./modules/tools/mermaid-png.js";
import { pdfProcessTool } from "./modules/tools/pdf-process.js";
import { permanentAgentToolBuild } from "./modules/tools/permanentAgentToolBuild.js";
import { buildReactionTool } from "./modules/tools/reaction.js";
import { buildSendFileTool } from "./modules/tools/send-file.js";
import { sendUserMessageToolBuild } from "./modules/tools/sendUserMessageTool.js";
import { sessionHistoryToolBuild } from "./modules/tools/sessionHistoryToolBuild.js";
import { buildSignalGenerateTool } from "./modules/tools/signal.js";
import { signalEventsCsvToolBuild } from "./modules/tools/signalEventsCsvToolBuild.js";
import { buildSignalSubscribeTool } from "./modules/tools/signalSubscribeToolBuild.js";
import { buildSignalUnsubscribeTool } from "./modules/tools/signalUnsubscribeToolBuild.js";
import { skillToolBuild } from "./modules/tools/skillToolBuild.js";
import { skipToolBuild } from "./modules/tools/skipTool.js";
import { toolListContextBuild } from "./modules/tools/toolListContextBuild.js";
import { topologyTool } from "./modules/tools/topologyToolBuild.js";
import { buildPluginCatalog } from "./plugins/catalog.js";
import { PluginManager } from "./plugins/manager.js";
import { PluginRegistry } from "./plugins/registry.js";
import { Processes } from "./processes/processes.js";
import { DelayedSignals } from "./signals/delayedSignals.js";
import { Signals } from "./signals/signals.js";
import { userHomeEnsure } from "./users/userHomeEnsure.js";
import { userHomeMigrate } from "./users/userHomeMigrate.js";

const logger = getLogger("engine.runtime");
const INCOMING_MESSAGES_DEBOUNCE_MS = 100;

export type EngineOptions = {
    config: Config;
    eventBus: EngineEventBus;
};

export class Engine {
    readonly config: ConfigModule;
    readonly authStore: AuthStore;
    readonly modules: ModuleRegistry;
    readonly pluginRegistry: PluginRegistry;
    readonly pluginManager: PluginManager;
    readonly providerManager: ProviderManager;
    readonly storage: Storage;
    readonly agentSystem: AgentSystem;
    readonly crons: Crons;
    readonly heartbeats: Heartbeats;
    readonly signals: Signals;
    readonly delayedSignals: DelayedSignals;
    readonly channels: Channels;
    readonly processes: Processes;
    readonly inferenceRouter: InferenceRouter;
    readonly eventBus: EngineEventBus;
    readonly apps: Apps;
    readonly exposes: Exposes;
    private readonly reloadSync: InvalidateSync;
    private readonly incomingMessages: IncomingMessages;

    constructor(options: EngineOptions) {
        logger.debug(`init: Engine constructor starting, dataDir=${options.config.dataDir}`);
        this.config = new ConfigModule(options.config);
        this.storage = Storage.open(this.config.current.dbPath);
        this.eventBus = options.eventBus;
        const fallbackUserIdResolve = async (): Promise<string> => {
            const owner = await this.storage.users.findOwner();
            return owner?.id ?? "owner";
        };
        this.signals = new Signals({
            eventBus: this.eventBus,
            signalEvents: this.storage.signalEvents,
            signalSubscriptions: this.storage.signalSubscriptions,
            onDeliver: async (signal, subscriptions) => {
                await this.agentSystem.signalDeliver(signal, subscriptions);
            }
        });
        this.delayedSignals = new DelayedSignals({
            config: this.config,
            eventBus: this.eventBus,
            signals: this.signals,
            delayedSignals: this.storage.delayedSignals
        });
        this.reloadSync = new InvalidateSync(async () => {
            await this.reloadApplyLatest();
        });
        this.authStore = new AuthStore(this.config.current);
        this.processes = new Processes(this.config.current.dataDir, getLogger("engine.processes"), {
            repository: this.storage.processes
        });
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
        logger.debug(`init: AuthStore initialized`);
        this.exposes = new Exposes({
            config: this.config,
            eventBus: this.eventBus,
            exposeEndpoints: this.storage.exposeEndpoints,
            fallbackUserIdResolve
        });

        this.modules = new ModuleRegistry({
            onMessage: async (message, context, descriptor) => {
                this.incomingMessages.post({ descriptor, message, context });
            },
            onCommand: async (command, context, descriptor) =>
                this.runConnectorCallback("command", async () => {
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
                    if (parsed.name === "compact") {
                        if (descriptor.type !== "user") {
                            return;
                        }
                        logger.info(
                            { connector, channelId: descriptor.channelId, userId: descriptor.userId },
                            "receive: Compact command received"
                        );
                        await this.handleCompactCommand(descriptor, context);
                        return;
                    }
                    if (parsed.name === "abort") {
                        if (descriptor.type !== "user") {
                            return;
                        }
                        logger.info(
                            { connector, channelId: descriptor.channelId, userId: descriptor.userId },
                            "stop: Abort command received"
                        );
                        await this.handleStopCommand(descriptor, context);
                        return;
                    }
                    if (descriptor.type !== "user") {
                        return;
                    }
                    const pluginCommand = this.modules.commands.get(parsed.name);
                    if (pluginCommand) {
                        logger.info(
                            {
                                connector,
                                command: parsed.name,
                                channelId: descriptor.channelId,
                                userId: descriptor.userId
                            },
                            "event: Dispatching plugin slash command"
                        );
                        await pluginCommand.handler(command, context, descriptor);
                        return;
                    }
                    logger.debug({ connector, command: parsed.name }, "event: Unknown command ignored");
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
        const stagingFileStore = new FileFolder(path.join(this.config.current.dataDir, "tmp", "staging"));

        this.pluginRegistry = new PluginRegistry(this.modules);

        this.pluginManager = new PluginManager({
            config: this.config,
            registry: this.pluginRegistry,
            auth: this.authStore,
            fileStore: stagingFileStore,
            pluginCatalog: buildPluginCatalog(),
            inferenceRouter: this.inferenceRouter,
            processes: this.processes,
            exposes: this.exposes,
            engineEvents: this.eventBus,
            onEvent: (event) => {
                this.agentSystem.eventBus.emit("plugin.event", event);
            }
        });

        this.providerManager = new ProviderManager({
            config: this.config,
            auth: this.authStore,
            fileStore: stagingFileStore,
            inferenceRegistry: this.modules.inference,
            imageRegistry: this.modules.images
        });

        this.agentSystem = new AgentSystem({
            config: this.config,
            eventBus: this.eventBus,
            storage: this.storage,
            connectorRegistry: this.modules.connectors,
            imageRegistry: this.modules.images,
            toolResolver: this.modules.tools,
            pluginManager: this.pluginManager,
            inferenceRouter: this.inferenceRouter,
            authStore: this.authStore,
            delayedSignals: this.delayedSignals
        });

        this.crons = new Crons({
            config: this.config,
            storage: this.storage,
            eventBus: this.eventBus,
            agentSystem: this.agentSystem
        });
        this.agentSystem.setCrons(this.crons);
        this.agentSystem.setSignals(this.signals);

        const heartbeats = new Heartbeats({
            config: this.config,
            storage: this.storage,
            eventBus: this.eventBus,
            intervalMs: 30 * 60 * 1000,
            agentSystem: this.agentSystem
        });
        this.heartbeats = heartbeats;
        this.agentSystem.setHeartbeats(heartbeats);
        this.channels = new Channels({
            channels: this.storage.channels,
            channelMessages: this.storage.channelMessages,
            signals: this.signals,
            agentSystem: this.agentSystem
        });
        this.apps = new Apps({
            usersDir: this.config.current.usersDir
        });
    }

    async start(): Promise<void> {
        logger.debug("start: Engine.start() beginning");
        const ownerUserId = await this.agentSystem.ownerUserIdEnsure();
        const ownerUserHome = this.agentSystem.userHomeForUserId(ownerUserId);
        await userHomeEnsure(ownerUserHome);
        await userHomeMigrate(this.config.current, this.storage);

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

        await this.channels.load();
        await this.exposes.start();

        logger.debug("register: Registering core tools");
        this.modules.tools.register("core", buildCronTool(this.crons));
        this.modules.tools.register("core", buildCronReadTaskTool(this.crons));
        this.modules.tools.register("core", buildCronDeleteTaskTool(this.crons));
        this.modules.tools.register("core", buildHeartbeatRunTool());
        this.modules.tools.register("core", buildHeartbeatAddTool());
        this.modules.tools.register("core", buildHeartbeatRemoveTool());
        this.modules.tools.register("core", buildStartBackgroundAgentTool());
        this.modules.tools.register("core", buildSendAgentMessageTool());
        this.modules.tools.register("core", agentResetToolBuild());
        this.modules.tools.register("core", agentCompactToolBuild());
        this.modules.tools.register("core", sendUserMessageToolBuild());
        this.modules.tools.register("core", skipToolBuild());
        this.modules.tools.register("core", skillToolBuild());
        this.modules.tools.register("core", topologyTool(this.crons, this.signals, this.channels, this.exposes));
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
        this.modules.tools.register("core", pdfProcessTool());
        this.modules.tools.register("core", buildSignalGenerateTool(this.signals));
        this.modules.tools.register("core", signalEventsCsvToolBuild(this.signals));
        this.modules.tools.register("core", buildSignalSubscribeTool(this.signals));
        this.modules.tools.register("core", buildSignalUnsubscribeTool(this.signals));
        this.modules.tools.register("core", appInstallToolBuild(this.apps));
        this.modules.tools.register("core", appRuleToolBuild(this.apps));
        this.modules.tools.register("core", exposeCreateToolBuild(this.exposes));
        this.modules.tools.register("core", exposeRemoveToolBuild(this.exposes));
        this.modules.tools.register("core", exposeUpdateToolBuild(this.exposes));
        this.modules.tools.register("core", exposeListToolBuild(this.exposes));
        if (this.config.current.features.rlm) {
            this.modules.tools.register("core", rlmToolBuild(this.modules.tools));
        }
        await this.apps.discover();
        this.apps.registerTools(this.modules.tools);
        logger.debug(
            "register: Core tools registered: cron, heartbeat, topology, background, agent_reset, agent_compact, send_user_message, skill, session_history, permanent_agents, channels, image_generation, mermaid_png, reaction, send_file, pdf_process, generate_signal, signal_events_csv, signal_subscribe, signal_unsubscribe, install_app, app_rules"
        );

        await this.pluginManager.preStartAll();

        logger.debug("start: Starting agent system");
        await this.agentSystem.start();
        logger.debug("start: Agent system started");

        logger.debug("start: Starting cron scheduler");
        await this.crons.start();
        logger.debug("start: Starting heartbeat scheduler");
        await this.heartbeats.start();
        logger.debug("start: Starting delayed signal scheduler");
        await this.delayedSignals.start();
        await this.pluginManager.postStartAll();
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
        await this.exposes.stop();
        await this.pluginManager.unloadAll();
        this.storage.close();
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
            noTools: rlmNoToolsModeIs(this.config.current.features),
            rlm: this.config.current.features.rlm,
            connectorRegistry: this.modules.connectors,
            imageRegistry: this.modules.images
        });
    }

    private async handleContextCommand(descriptor: AgentDescriptor, context: MessageContext): Promise<void> {
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
        const contextLimit = this.config.current.settings.agents.emergencyContextLimit;
        const text = messageContextStatus({ tokens, contextLimit });
        try {
            await connector.sendMessage(target.targetId, {
                text,
                replyToMessageId: context.messageId
            });
        } catch (error) {
            logger.warn({ connector: target.connector, error }, "error: Context command failed to send response");
        }
    }

    private async handleCompactCommand(descriptor: AgentDescriptor, context: MessageContext): Promise<void> {
        await this.agentSystem.post({ descriptor }, { type: "compact", context });
    }

    private async handleResetCommand(descriptor: AgentDescriptor, context: MessageContext): Promise<void> {
        const dropped = this.incomingMessages.dropForDescriptor(descriptor);
        if (dropped > 0) {
            logger.debug({ dropped }, "event: Dropped pending connector messages before reset");
        }
        await this.agentSystem.post(
            { descriptor },
            { type: "reset", message: "Manual reset requested by the user.", context }
        );
    }

    private async handleStopCommand(descriptor: AgentDescriptor, context: MessageContext): Promise<void> {
        const target = agentDescriptorTargetResolve(descriptor);
        if (!target) {
            return;
        }
        const connector = this.modules.connectors.get(target.connector);
        if (!connector?.capabilities.sendText) {
            return;
        }
        const aborted = this.agentSystem.abortInferenceForTarget({ descriptor });
        const text = aborted ? "Stopped current inference." : "No active inference to stop.";
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

    private async runConnectorCallback(kind: "message" | "command", operation: () => Promise<void>): Promise<void> {
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
            const ownerUserId = await this.agentSystem.ownerUserIdEnsure();
            await userHomeEnsure(this.agentSystem.userHomeForUserId(ownerUserId));
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
/**
 * Compares reloadable runtime config fields.
 * Keep this in sync with `Config` whenever runtime behavior changes.
 */
function configReloadEqual(left: Config, right: Config): boolean {
    return (
        configReloadPathsEqual(left, right) &&
        left.verbose === right.verbose &&
        valueDeepEqual(left.settings, right.settings) &&
        left.usersDir === right.usersDir
    );
}

function configReloadPathsEqual(left: Config, right: Config): boolean {
    return (
        left.settingsPath === right.settingsPath &&
        left.configDir === right.configDir &&
        left.dataDir === right.dataDir &&
        left.agentsDir === right.agentsDir &&
        left.usersDir === right.usersDir &&
        left.authPath === right.authPath &&
        left.socketPath === right.socketPath
    );
}
