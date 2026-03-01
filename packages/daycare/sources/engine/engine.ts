import { promises as fs } from "node:fs";
import path from "node:path";

import Docker from "dockerode";

import type { AgentDescriptor, AgentTokenEntry, Config, ConnectorMessage, Context, MessageContext } from "@/types";
import { AppServer } from "../api/app-server/appServer.js";
import { AuthStore } from "../auth/store.js";
import { configLoad } from "../config/configLoad.js";
import { getLogger } from "../log.js";
import { getProviderDefinition } from "../providers/catalog.js";
import { ProviderManager } from "../providers/manager.js";
import { dockerContainersStaleRemove } from "../sandbox/docker/dockerContainersStaleRemove.js";
import { databaseClose } from "../storage/databaseClose.js";
import { databaseMigrate } from "../storage/databaseMigrate.js";
import { databaseOpen } from "../storage/databaseOpen.js";
import { Storage } from "../storage/storage.js";
import { userConnectorKeyCreate } from "../storage/userConnectorKeyCreate.js";
import { InvalidateSync } from "../util/sync.js";
import { valueDeepEqual } from "../util/valueDeepEqual.js";
import { AgentSystem } from "./agents/agentSystem.js";
import { contextForUser } from "./agents/context.js";
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
import type { EngineEventBus } from "./ipc/events.js";
import { Memory } from "./memory/memory.js";
import { MemoryWorker } from "./memory/memoryWorker.js";
import { IncomingMessages } from "./messages/incomingMessages.js";
import { messageContextEnrichIncoming } from "./messages/messageContextEnrichIncoming.js";
import { InferenceRouter } from "./modules/inference/router.js";
import { ModuleRegistry } from "./modules/moduleRegistry.js";
import { agentCompactToolBuild } from "./modules/tools/agentCompactTool.js";
import { agentModelSetToolBuild } from "./modules/tools/agentModelSetToolBuild.js";
import { agentResetToolBuild } from "./modules/tools/agentResetTool.js";
import { buildSendAgentMessageTool, buildStartBackgroundAgentTool } from "./modules/tools/background.js";
import { channelCreateToolBuild } from "./modules/tools/channelCreateTool.js";
import { channelHistoryToolBuild } from "./modules/tools/channelHistoryTool.js";
import { channelAddMemberToolBuild, channelRemoveMemberToolBuild } from "./modules/tools/channelMemberTool.js";
import { channelSendToolBuild } from "./modules/tools/channelSendTool.js";
import { exposeCreateToolBuild } from "./modules/tools/exposeCreateToolBuild.js";
import { exposeListToolBuild } from "./modules/tools/exposeListToolBuild.js";
import { exposeRemoveToolBuild } from "./modules/tools/exposeRemoveToolBuild.js";
import { exposeUpdateToolBuild } from "./modules/tools/exposeUpdateToolBuild.js";
import { friendAddToolBuild } from "./modules/tools/friendAddToolBuild.js";
import { friendRemoveToolBuild } from "./modules/tools/friendRemoveToolBuild.js";
import { friendSendToolBuild } from "./modules/tools/friendSendToolBuild.js";
import { friendShareSubuserToolBuild } from "./modules/tools/friendShareSubuserToolBuild.js";
import { friendUnshareSubuserToolBuild } from "./modules/tools/friendUnshareSubuserToolBuild.js";
import { buildImageGenerationTool } from "./modules/tools/image-generation.js";
import { inferenceClassifyToolBuild } from "./modules/tools/inference/inferenceClassifyToolBuild.js";
import { inferenceSummaryToolBuild } from "./modules/tools/inference/inferenceSummaryToolBuild.js";
import { buildMediaAnalysisTool } from "./modules/tools/media-analysis.js";
import { memoryNodeReadToolBuild } from "./modules/tools/memoryNodeReadToolBuild.js";
import { memoryNodeWriteToolBuild } from "./modules/tools/memoryNodeWriteToolBuild.js";
import { memorySearchToolBuild } from "./modules/tools/memorySearchToolBuild.js";
import { buildMermaidPngTool } from "./modules/tools/mermaid-png.js";
import { pdfProcessTool } from "./modules/tools/pdf-process.js";
import { permanentAgentToolBuild } from "./modules/tools/permanentAgentToolBuild.js";
import { buildReactionTool } from "./modules/tools/reaction.js";
import { sayTool } from "./modules/tools/sayTool.js";
import { secretAddToolBuild } from "./modules/tools/secretAddToolBuild.js";
import { secretRemoveToolBuild } from "./modules/tools/secretRemoveToolBuild.js";
import { buildSendFileTool } from "./modules/tools/send-file.js";
import { sendUserMessageToolBuild } from "./modules/tools/sendUserMessageTool.js";
import { sessionHistoryToolBuild } from "./modules/tools/sessionHistoryToolBuild.js";
import { buildSignalGenerateTool } from "./modules/tools/signal.js";
import { signalEventsCsvToolBuild } from "./modules/tools/signalEventsCsvToolBuild.js";
import { buildSignalSubscribeTool } from "./modules/tools/signalSubscribeToolBuild.js";
import { buildSignalUnsubscribeTool } from "./modules/tools/signalUnsubscribeToolBuild.js";
import { skillAddToolBuild } from "./modules/tools/skillAddToolBuild.js";
import { skillRemoveToolBuild } from "./modules/tools/skillRemoveToolBuild.js";
import { skillToolBuild } from "./modules/tools/skillToolBuild.js";
import { buildSpeechGenerationTool } from "./modules/tools/speech-generation.js";
import { subuserConfigureToolBuild } from "./modules/tools/subuserConfigureToolBuild.js";
import { subuserCreateToolBuild } from "./modules/tools/subuserCreateToolBuild.js";
import { subuserListToolBuild } from "./modules/tools/subuserListToolBuild.js";
import {
    buildTaskCreateTool,
    buildTaskDeleteTool,
    buildTaskReadTool,
    buildTaskRunTool,
    buildTaskTriggerAddTool,
    buildTaskTriggerRemoveTool,
    buildTaskUpdateTool
} from "./modules/tools/task.js";
import { topologyTool } from "./modules/tools/topologyToolBuild.js";
import { userProfileUpdateTool } from "./modules/tools/userProfileUpdateTool.js";
import { buildVoiceListTool } from "./modules/tools/voice-list.js";
import { observationQueryToolBuild } from "./observations/observationQueryToolBuild.js";
import { buildPluginCatalog } from "./plugins/catalog.js";
import { PluginManager } from "./plugins/manager.js";
import { PluginRegistry } from "./plugins/registry.js";
import { Processes } from "./processes/processes.js";
import { Secrets } from "./secrets/secrets.js";
import { DelayedSignals } from "./signals/delayedSignals.js";
import { Signals } from "./signals/signals.js";
import { taskListActive } from "./tasks/taskListActive.js";
import { userHomeEnsure } from "./users/userHomeEnsure.js";
import { userHomeMigrate } from "./users/userHomeMigrate.js";
import { Webhooks } from "./webhook/webhooks.js";

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
    readonly webhooks: Webhooks;
    readonly appServer: AppServer;
    readonly signals: Signals;
    readonly delayedSignals: DelayedSignals;
    readonly channels: Channels;
    readonly processes: Processes;
    readonly inferenceRouter: InferenceRouter;
    readonly eventBus: EngineEventBus;
    readonly apps: Apps;
    readonly memory: Memory;
    readonly secrets: Secrets;
    readonly exposes: Exposes;
    private readonly memoryWorker: MemoryWorker;
    private readonly reloadSync: InvalidateSync;
    private readonly incomingMessages: IncomingMessages;
    private readonly migrationReady: Promise<void>;

    constructor(options: EngineOptions) {
        logger.debug(`init: Engine constructor starting, dataDir=${options.config.dataDir}`);
        this.config = new ConfigModule(options.config);
        const dbTarget = this.config.current.db.url
            ? { kind: "postgres" as const, url: this.config.current.db.url }
            : this.config.current.db.path;
        const db = databaseOpen(dbTarget);
        if (this.config.current.db.autoMigrate) {
            this.migrationReady = databaseMigrate(db).then(() => undefined);
        } else {
            this.migrationReady = Promise.resolve();
            logger.info("skip: Auto migrations disabled by engine.db.autoMigrate=false");
        }
        this.storage = Storage.fromDatabase(db);
        // memoryWorker is initialized after inferenceRouter — see below
        this.eventBus = options.eventBus;
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
                        const ctx = await this.descriptorContextResolve(item.descriptor);
                        await this.agentSystem.post(
                            ctx,
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
            exposeEndpoints: this.storage.exposeEndpoints
        });

        this.modules = new ModuleRegistry({
            onMessage: async (message, context, descriptor) =>
                this.runConnectorCallback("message", async () => {
                    const ctx = await this.descriptorContextResolve(descriptor);
                    const messageContext = await this.messageContextWithTimezone(ctx, context);
                    const normalized = await this.messageFilesToDownloads(ctx, message);
                    this.incomingMessages.post({ descriptor, message: normalized, context: messageContext });
                }),
            onCommand: async (command, context, descriptor) =>
                this.runConnectorCallback("command", async () => {
                    const connector = descriptor.type === "user" ? descriptor.connector : "unknown";
                    let messageContext = context;
                    if (descriptor.type === "user" || descriptor.type === "subuser") {
                        const ctx = await this.descriptorContextResolve(descriptor);
                        messageContext = await this.messageContextWithTimezone(ctx, context);
                    }
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
                        await this.handleResetCommand(descriptor, messageContext);
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
                        await this.handleContextCommand(descriptor, messageContext);
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
                        await this.handleCompactCommand(descriptor, messageContext);
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
                        await this.handleStopCommand(descriptor, messageContext);
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
                        await pluginCommand.handler(command, messageContext, descriptor);
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
        this.memoryWorker = new MemoryWorker({
            storage: this.storage,
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
        this.memory = new Memory({
            usersDir: this.config.current.usersDir
        });
        this.secrets = new Secrets(this.config.current.usersDir);

        this.agentSystem = new AgentSystem({
            config: this.config,
            eventBus: this.eventBus,
            storage: this.storage,
            connectorRegistry: this.modules.connectors,
            imageRegistry: this.modules.images,
            mediaRegistry: this.modules.mediaAnalysis,
            toolResolver: this.modules.tools,
            pluginManager: this.pluginManager,
            inferenceRouter: this.inferenceRouter,
            authStore: this.authStore,
            memory: this.memory,
            secrets: this.secrets,
            delayedSignals: this.delayedSignals
        });

        this.memoryWorker.setPostFn((ctx, target, item) => this.agentSystem.post(ctx, target, item));

        this.crons = new Crons({
            config: this.config,
            storage: this.storage,
            eventBus: this.eventBus,
            agentSystem: this.agentSystem
        });
        this.agentSystem.setCrons(this.crons);
        this.agentSystem.setSignals(this.signals);
        this.webhooks = new Webhooks({
            storage: this.storage,
            agentSystem: this.agentSystem
        });
        this.agentSystem.setWebhooks(this.webhooks);
        this.pluginManager.setWebhooks(this.webhooks);
        this.appServer = new AppServer({
            config: this.config,
            auth: this.authStore,
            commandRegistry: this.modules.commands,
            connectorRegistry: this.modules.connectors,
            toolResolver: this.modules.tools,
            webhooks: this.webhooks,
            tasksListActive: (ctx) => taskListActive({ storage: this.storage, ctx }),
            tokenStatsFetch: (ctx, options) => this.storage.tokenStats.findAll({ ...options, userId: ctx.userId })
        });
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
        await this.migrationReady;
        const ownerCtx = await this.agentSystem.ownerCtxEnsure();
        const ownerUserHome = this.agentSystem.userHomeForUserId(ownerCtx.userId);
        await userHomeEnsure(ownerUserHome);
        await userHomeMigrate(this.config.current, this.storage);
        if (this.config.current.docker.enabled) {
            const imageRef = `${this.config.current.docker.image}:${this.config.current.docker.tag}`;
            try {
                const docker = this.config.current.docker.socketPath
                    ? new Docker({ socketPath: this.config.current.docker.socketPath })
                    : new Docker();
                await dockerContainersStaleRemove(docker, imageRef);
            } catch (error) {
                logger.warn({ imageRef, error }, "stale: Failed to remove stale Docker sandbox containers on startup");
            }
        }

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
        await this.appServer.start();

        await this.channels.load();
        await this.exposes.start();

        logger.debug("register: Registering core tools");
        this.modules.tools.register("core", buildTaskCreateTool());
        this.modules.tools.register("core", buildTaskReadTool());
        this.modules.tools.register("core", buildTaskUpdateTool());
        this.modules.tools.register("core", buildTaskDeleteTool());
        this.modules.tools.register("core", buildTaskRunTool());
        this.modules.tools.register("core", buildTaskTriggerAddTool());
        this.modules.tools.register("core", buildTaskTriggerRemoveTool());
        this.modules.tools.register("core", buildStartBackgroundAgentTool());
        this.modules.tools.register("core", buildSendAgentMessageTool());
        this.modules.tools.register("core", memorySearchToolBuild());
        this.modules.tools.register("core", inferenceSummaryToolBuild(this.inferenceRouter, this.config));
        this.modules.tools.register("core", inferenceClassifyToolBuild(this.inferenceRouter, this.config));
        this.modules.tools.register("core", agentModelSetToolBuild());
        this.modules.tools.register("core", agentResetToolBuild());
        this.modules.tools.register("core", agentCompactToolBuild());
        this.modules.tools.register("core", sendUserMessageToolBuild());
        this.modules.tools.register("core", skillToolBuild());
        this.modules.tools.register("core", skillAddToolBuild());
        this.modules.tools.register("core", skillRemoveToolBuild());
        this.modules.tools.register("core", secretAddToolBuild());
        this.modules.tools.register("core", secretRemoveToolBuild());
        this.modules.tools.register("core", userProfileUpdateTool());
        this.modules.tools.register(
            "core",
            topologyTool(this.crons, this.signals, this.channels, this.exposes, this.secrets)
        );
        this.modules.tools.register("core", sessionHistoryToolBuild());
        this.modules.tools.register("core", permanentAgentToolBuild());
        this.modules.tools.register("core", subuserCreateToolBuild());
        this.modules.tools.register("core", subuserConfigureToolBuild());
        this.modules.tools.register("core", subuserListToolBuild());
        this.modules.tools.register("core", channelCreateToolBuild(this.channels));
        this.modules.tools.register("core", channelSendToolBuild(this.channels));
        this.modules.tools.register("core", channelHistoryToolBuild(this.channels));
        this.modules.tools.register("core", channelAddMemberToolBuild(this.channels));
        this.modules.tools.register("core", channelRemoveMemberToolBuild(this.channels));
        this.modules.tools.register("core", friendAddToolBuild());
        this.modules.tools.register("core", friendRemoveToolBuild());
        this.modules.tools.register("core", friendSendToolBuild());
        this.modules.tools.register("core", friendShareSubuserToolBuild());
        this.modules.tools.register("core", friendUnshareSubuserToolBuild());
        this.modules.tools.register("core", buildImageGenerationTool(this.modules.images));
        this.modules.tools.register("core", buildSpeechGenerationTool(this.modules.speech));
        this.modules.tools.register("core", buildVoiceListTool(this.modules.speech));
        this.modules.tools.register("core", buildMediaAnalysisTool(this.modules.mediaAnalysis));
        this.modules.tools.register("core", buildMermaidPngTool());
        this.modules.tools.register("core", buildReactionTool());
        this.modules.tools.register("core", sayTool());
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
        this.modules.tools.register("core", observationQueryToolBuild(this.storage.observationLog));
        this.modules.tools.register("core", memoryNodeReadToolBuild());
        this.modules.tools.register("core", memoryNodeWriteToolBuild());
        await this.apps.discover();
        this.apps.registerTools(this.modules.tools);
        logger.debug(
            "register: Core tools registered: tasks, topology, user_profile_update, background, inference_summary, inference_classify, agent_reset, agent_compact, send_user_message, skill, session_history, permanent_agents, channels, image_generation, speech_generation, voice_list, media_analysis, mermaid_png, reaction, say, send_file, pdf_process, generate_signal, signal_events_csv, signal_subscribe, signal_unsubscribe, install_app, app_rules"
        );

        await this.pluginManager.preStartAll();

        logger.debug("start: Starting agent system");
        await this.agentSystem.start();
        logger.debug("start: Agent system started");

        logger.debug("start: Starting cron scheduler");
        await this.crons.start();
        logger.debug("start: Starting delayed signal scheduler");
        await this.delayedSignals.start();
        logger.debug("start: Starting memory worker");
        this.memoryWorker.start();
        await this.pluginManager.postStartAll();
        logger.debug("start: Engine.start() complete");
    }

    async shutdown(): Promise<void> {
        await this.migrationReady.catch((error) => {
            logger.warn({ error }, "migrate: Migration check failed during shutdown");
        });
        this.memoryWorker.stop();
        this.reloadSync.stop();
        await this.appServer.stop();
        await this.modules.connectors.unregisterAll("shutdown");
        await this.incomingMessages.flush();
        this.crons.stop();
        this.webhooks.stop();
        this.delayedSignals.stop();
        this.processes.unload();
        await this.exposes.stop();
        await this.pluginManager.unloadAll();
        await databaseClose(this.storage.connection);
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
            tools: []
        };
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
            const ctx = await this.descriptorContextResolve(descriptor);
            tokens = await this.agentSystem.tokensForTarget(ctx, { descriptor });
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
        const ctx = await this.descriptorContextResolve(descriptor);
        await this.agentSystem.post(ctx, { descriptor }, { type: "compact", context });
    }

    private async handleResetCommand(descriptor: AgentDescriptor, context: MessageContext): Promise<void> {
        const dropped = this.incomingMessages.dropForDescriptor(descriptor);
        if (dropped > 0) {
            logger.debug({ dropped }, "event: Dropped pending connector messages before reset");
        }
        const ctx = await this.descriptorContextResolve(descriptor);
        await this.agentSystem.post(
            ctx,
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

    /**
     * Resolves runtime user context from an incoming descriptor.
     * Expects: user descriptors map connector identity to an internal user id.
     */
    private async descriptorContextResolve(descriptor: AgentDescriptor) {
        await this.migrationReady;
        if (descriptor.type === "user") {
            const connectorKey = userConnectorKeyCreate(descriptor.connector, descriptor.userId);
            try {
                const user = await this.storage.resolveUserByConnectorKey(connectorKey);
                return contextForUser({ userId: user.id });
            } catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                throw new Error(`Failed to resolve user for connector key ${connectorKey}: ${detail}`, {
                    cause: error
                });
            }
        }
        if (descriptor.type === "subuser") {
            return contextForUser({ userId: descriptor.id });
        }
        throw new Error(`Descriptor type does not resolve to a user context: ${descriptor.type}`);
    }

    /**
     * Resolves effective message timezone and stable enrichment tags for incoming messages.
     * Expects: ctx belongs to the current runtime user.
     */
    private async messageContextWithTimezone(ctx: Context, context: MessageContext): Promise<MessageContext> {
        const user = await this.storage.users.findById(ctx.userId);
        return messageContextEnrichIncoming({
            context,
            user,
            timezonePersist: async (timezone) =>
                this.storage.users.update(ctx.userId, {
                    timezone,
                    updatedAt: Date.now()
                })
        });
    }

    /**
     * Routes connector-emitted file paths into the recipient user's downloads folder.
     * Expects: ctx resolves to the descriptor's owning user.
     */
    private async messageFilesToDownloads(ctx: Context, message: ConnectorMessage): Promise<ConnectorMessage> {
        const files = message.files;
        if (!files || files.length === 0) {
            return message;
        }

        const userHome = this.agentSystem.userHomeForUserId(ctx.userId);
        await userHomeEnsure(userHome);
        const downloadsDir = path.resolve(userHome.downloads);
        const stagingDir = path.resolve(this.config.current.dataDir, "tmp", "staging");
        const downloadsStore = new FileFolder(downloadsDir);
        const normalizedFiles: NonNullable<ConnectorMessage["files"]> = [];

        for (const file of files) {
            const resolvedPath = path.resolve(file.path);
            if (pathWithin(downloadsDir, resolvedPath)) {
                normalizedFiles.push(file);
                continue;
            }

            try {
                const saved = await downloadsStore.saveFromPath({
                    name: file.name,
                    mimeType: file.mimeType,
                    path: resolvedPath
                });
                if (pathWithin(stagingDir, resolvedPath)) {
                    await fs.rm(resolvedPath, { force: true });
                }
                normalizedFiles.push({
                    ...file,
                    id: saved.id,
                    name: saved.name,
                    path: saved.path,
                    mimeType: saved.mimeType,
                    size: saved.size
                });
            } catch (error) {
                logger.warn(
                    { userId: ctx.userId, filePath: file.path, error },
                    "warn: Failed to route connector file to user downloads"
                );
                normalizedFiles.push(file);
            }
        }

        return {
            ...message,
            files: normalizedFiles
        };
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
            const ownerCtx = await this.agentSystem.ownerCtxEnsure();
            await userHomeEnsure(this.agentSystem.userHomeForUserId(ownerCtx.userId));
            await this.providerManager.reload();
            await this.pluginManager.reload();
            await this.appServer.reload();
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

function pathWithin(parentDir: string, targetPath: string): boolean {
    const resolvedParent = path.resolve(parentDir);
    const resolvedTarget = path.resolve(targetPath);
    return resolvedTarget === resolvedParent || resolvedTarget.startsWith(`${resolvedParent}${path.sep}`);
}
