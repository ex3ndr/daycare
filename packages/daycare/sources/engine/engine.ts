import { promises as fs } from "node:fs";
import path from "node:path";

import Docker from "dockerode";

import type { AgentPath, Config, ConnectorMessage, ConnectorTarget, Context, MessageContext } from "@/types";
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
import { stringSlugify } from "../utils/stringSlugify.js";
import { InvalidateSync } from "../utils/sync.js";
import { valueDeepEqual } from "../utils/valueDeepEqual.js";
import { AgentSystem } from "./agents/agentSystem.js";
import { contextForAgent, contextForUser } from "./agents/context.js";
import { agentHistoryLoad } from "./agents/ops/agentHistoryLoad.js";
import { agentPathConnector } from "./agents/ops/agentPathBuild.js";
import { agentPath } from "./agents/ops/agentPathTypes.js";
import { contextEstimateTokens } from "./agents/ops/contextEstimateTokens.js";
import { messageContextStatus } from "./agents/ops/messageContextStatus.js";
import { Channels } from "./channels/channels.js";
import { ConfigModule } from "./config/configModule.js";
import { Crons } from "./cron/crons.js";
import { Exposes } from "./expose/exposes.js";
import { FileFolder } from "./files/fileFolder.js";
import { Friends } from "./friends/friends.js";
import type { EngineEventBus } from "./ipc/events.js";
import { memoryRootDocumentEnsure } from "./memory/memoryRootDocumentEnsure.js";
import { MemoryWorker } from "./memory/memoryWorker.js";
import { IncomingMessages } from "./messages/incomingMessages.js";
import { messageContextEnrichIncoming } from "./messages/messageContextEnrichIncoming.js";
import { InferenceRouter } from "./modules/inference/router.js";
import { ModuleRegistry } from "./modules/moduleRegistry.js";
import { taskParameterInputsNormalize } from "./modules/tasks/taskParameterInputsNormalize.js";
import { taskParameterValidate } from "./modules/tasks/taskParameterValidate.js";
import { agentCompactToolBuild } from "./modules/tools/agentCompactTool.js";
import { agentModelSetToolBuild } from "./modules/tools/agentModelSetToolBuild.js";
import { agentResetToolBuild } from "./modules/tools/agentResetTool.js";
import { buildSendAgentMessageTool, buildStartBackgroundAgentTool } from "./modules/tools/background.js";
import { channelCreateToolBuild } from "./modules/tools/channelCreateTool.js";
import { channelHistoryToolBuild } from "./modules/tools/channelHistoryTool.js";
import { channelAddMemberToolBuild, channelRemoveMemberToolBuild } from "./modules/tools/channelMemberTool.js";
import { channelSendToolBuild } from "./modules/tools/channelSendTool.js";
import { documentReadToolBuild } from "./modules/tools/documentReadToolBuild.js";
import { documentSearchToolBuild } from "./modules/tools/documentSearchToolBuild.js";
import { documentWriteToolBuild } from "./modules/tools/documentWriteToolBuild.js";
import { exposeCreateToolBuild } from "./modules/tools/exposeCreateToolBuild.js";
import { exposeListToolBuild } from "./modules/tools/exposeListToolBuild.js";
import { exposeRemoveToolBuild } from "./modules/tools/exposeRemoveToolBuild.js";
import { exposeUpdateToolBuild } from "./modules/tools/exposeUpdateToolBuild.js";
import { friendAddToolBuild } from "./modules/tools/friendAddToolBuild.js";
import { friendRemoveToolBuild } from "./modules/tools/friendRemoveToolBuild.js";
import { friendSendToolBuild } from "./modules/tools/friendSendToolBuild.js";
import { buildImageGenerationTool } from "./modules/tools/image-generation.js";
import { inferenceClassifyToolBuild } from "./modules/tools/inference/inferenceClassifyToolBuild.js";
import { inferenceSummaryToolBuild } from "./modules/tools/inference/inferenceSummaryToolBuild.js";
import { buildMediaAnalysisTool } from "./modules/tools/media-analysis.js";
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
import { Skills } from "./skills/skills.js";
import { swarmCreateToolBuild } from "./swarms/swarmCreateToolBuild.js";
import { Swarms } from "./swarms/swarms.js";
import { taskDeleteSuccessResolve } from "./tasks/taskDeleteSuccessResolve.js";
import { TaskExecutions } from "./tasks/taskExecutions.js";
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
    readonly taskExecutions: TaskExecutions;
    readonly channels: Channels;
    readonly processes: Processes;
    readonly inferenceRouter: InferenceRouter;
    readonly eventBus: EngineEventBus;
    readonly swarms: Swarms;
    readonly secrets: Secrets;
    readonly exposes: Exposes;
    readonly friends: Friends;
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
            observationLog: this.storage.observationLog,
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
                        const resolved = await this.pathCanonicalize(item.path);
                        logger.debug(
                            `receive: Connector message received: path=${resolved.path} merged=${item.count} text=${item.message.text?.length ?? 0}chars files=${item.message.files?.length ?? 0}`
                        );
                        const connectorPath = connectorPathResolve(resolved.path);
                        await this.agentSystem.post(
                            resolved.ctx,
                            { path: resolved.path },
                            { type: "message", message: item.message, context: item.context },
                            {
                                kind: "connector",
                                foreground: true,
                                connectorName: connectorPath?.connector ?? null
                            }
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
            observationLog: this.storage.observationLog
        });

        this.modules = new ModuleRegistry({
            onMessage: async (message, context, target) =>
                this.runConnectorCallback("message", async () => {
                    const resolved = await this.targetCanonicalize(target);
                    const ctx = resolved.ctx;
                    const messageContext = await this.messageContextWithTimezone(ctx, context);
                    const normalized = await this.messageFilesToDownloads(ctx, message);
                    this.incomingMessages.post({ path: resolved.path, message: normalized, context: messageContext });
                }),
            onCommand: async (command, context, target) =>
                this.runConnectorCallback("command", async () => {
                    const resolved = await this.targetCanonicalize(target);
                    const connectorTarget = await this.connectorTargetResolve(resolved.path);
                    const isConnector = connectorTarget !== null;
                    const connector = connectorTarget?.connector ?? "unknown";
                    const messageContext = await this.messageContextWithTimezone(resolved.ctx, context);
                    const parsed = parseCommand(command);
                    if (!parsed) {
                        return;
                    }
                    if (parsed.name === "reset") {
                        if (!isConnector) {
                            return;
                        }
                        logger.info({ connector, path: resolved.path }, "receive: Reset command received");
                        await this.handleResetCommand(resolved.path, messageContext);
                        return;
                    }
                    if (parsed.name === "context") {
                        if (!isConnector) {
                            return;
                        }
                        logger.info({ connector, path: resolved.path }, "receive: Context command received");
                        await this.handleContextCommand(resolved.path, messageContext);
                        return;
                    }
                    if (parsed.name === "compact") {
                        if (!isConnector) {
                            return;
                        }
                        logger.info({ connector, path: resolved.path }, "receive: Compact command received");
                        await this.handleCompactCommand(resolved.path, messageContext);
                        return;
                    }
                    if (parsed.name === "abort") {
                        if (!isConnector) {
                            return;
                        }
                        logger.info({ connector, path: resolved.path }, "stop: Abort command received");
                        await this.handleStopCommand(resolved.path, messageContext);
                        return;
                    }
                    if (!isConnector) {
                        return;
                    }
                    const pluginCommand = this.modules.commands.get(parsed.name);
                    if (pluginCommand) {
                        logger.info(
                            {
                                connector,
                                command: parsed.name,
                                path: resolved.path
                            },
                            "event: Dispatching plugin slash command"
                        );
                        await pluginCommand.handler(command, messageContext, resolved.path);
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

        this.pluginRegistry = new PluginRegistry(this.modules, (path) => this.connectorTargetResolve(path));

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
        this.secrets = new Secrets({
            usersDir: this.config.current.usersDir,
            observationLog: this.storage.observationLog
        });

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
            secrets: this.secrets,
            delayedSignals: this.delayedSignals
        });
        this.friends = new Friends({
            storage: this.storage,
            postToUserAgents: (userId, item) => this.agentSystem.postToUserAgents(userId, item)
        });
        this.swarms = new Swarms({
            storage: this.storage,
            userHomeForUserId: (userId) => this.agentSystem.userHomeForUserId(userId)
        });
        this.agentSystem.setExtraMountsForUserId((userId) => this.swarms.mountsForOwner(userId));

        this.memoryWorker.setPostFn((ctx, target, item, creationConfig) =>
            this.agentSystem.post(ctx, target, item, creationConfig)
        );
        this.taskExecutions = new TaskExecutions({
            agentSystem: this.agentSystem
        });
        this.agentSystem.setTaskExecutions(this.taskExecutions);

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
            users: this.storage.users,
            agentCallbacks: {
                agentList: async (ctx) => {
                    const records = await this.storage.agents.findByUserId(ctx.userId);
                    return records.map((record) => ({
                        agentId: record.id,
                        descriptor: record.descriptor,
                        lifecycle: record.lifecycle,
                        updatedAt: record.updatedAt,
                        userId: record.userId
                    }));
                },
                agentHistoryLoad: async (ctx, agentId, limit) => {
                    const normalizedAgentId = agentId.trim();
                    if (!normalizedAgentId) {
                        return [];
                    }
                    const agent = await this.storage.agents.findById(normalizedAgentId);
                    if (!agent || agent.userId !== ctx.userId) {
                        return [];
                    }
                    return this.storage.history.findByAgentId(normalizedAgentId, limit);
                },
                agentPost: (ctx, target, item) => this.agentSystem.post(ctx, target, item)
            },
            eventBus: this.eventBus,
            skills: async (ctx) => {
                const userHome = this.agentSystem.userHomeForUserId(ctx.userId);
                const configSkillsRoot = path.join(this.config.current.configDir, "skills");
                const skills = new Skills({
                    configRoot: configSkillsRoot,
                    pluginManager: this.pluginManager,
                    userPersonalRoot: userHome.skillsPersonal,
                    userActiveRoot: userHome.skillsActive
                });
                return skills.list();
            },
            tasksListActive: (ctx) => taskListActive({ storage: this.storage, ctx }),
            taskCallbacks: {
                tasksCreate: async (ctx, input) => {
                    const taskId = await taskIdGenerateFromTitle(this.storage, ctx, input.title);
                    const now = Date.now();
                    await this.storage.tasks.create({
                        id: taskId,
                        userId: ctx.userId,
                        title: input.title,
                        description: input.description ?? null,
                        code: input.code,
                        parameters: input.parameters ?? null,
                        createdAt: now,
                        updatedAt: now
                    });
                    const created = await this.storage.tasks.findById(ctx, taskId);
                    if (!created) {
                        throw new Error(`Task not found after create: ${taskId}`);
                    }
                    return created;
                },
                tasksRead: async (ctx, taskId) => {
                    const normalizedTaskId = taskId.trim();
                    if (!normalizedTaskId) {
                        return null;
                    }
                    const task = await this.storage.tasks.findById(ctx, normalizedTaskId);
                    if (!task) {
                        return null;
                    }
                    const [cron, webhook] = await Promise.all([
                        this.storage.cronTasks.findManyByTaskId(ctx, normalizedTaskId),
                        this.storage.webhookTasks.findManyByTaskId(ctx, normalizedTaskId)
                    ]);
                    return {
                        task,
                        triggers: { cron, webhook }
                    };
                },
                tasksUpdate: async (ctx, taskId, input) => {
                    const normalizedTaskId = taskId.trim();
                    if (!normalizedTaskId) {
                        return null;
                    }
                    const existing = await this.storage.tasks.findById(ctx, normalizedTaskId);
                    if (!existing) {
                        return null;
                    }
                    await this.storage.tasks.update(ctx, normalizedTaskId, {
                        title: input.title ?? existing.title,
                        code: input.code ?? existing.code,
                        description: input.description === undefined ? existing.description : input.description,
                        parameters: input.parameters === undefined ? existing.parameters : input.parameters,
                        updatedAt: Date.now()
                    });
                    return this.storage.tasks.findById(ctx, normalizedTaskId);
                },
                tasksDelete: async (ctx, taskId) => {
                    const normalizedTaskId = taskId.trim();
                    if (!normalizedTaskId) {
                        return false;
                    }
                    const existing = await this.storage.tasks.findById(ctx, normalizedTaskId);
                    if (!existing) {
                        return false;
                    }
                    await Promise.all([
                        this.crons.deleteTriggersForTask(ctx, normalizedTaskId),
                        this.webhooks.deleteTriggersForTask(ctx, normalizedTaskId)
                    ]);
                    const deletedDirect = await this.storage.tasks.delete(ctx, normalizedTaskId);
                    const taskAfterCleanup = await this.storage.tasks.findById(ctx, normalizedTaskId);
                    return taskDeleteSuccessResolve(deletedDirect, taskAfterCleanup);
                },
                tasksRun: async (ctx, taskId, input) => {
                    const normalizedTaskId = taskId.trim();
                    if (!normalizedTaskId) {
                        throw new Error("taskId is required.");
                    }

                    const task = await this.storage.tasks.findById(ctx, normalizedTaskId);
                    if (!task) {
                        throw new Error("Task not found.");
                    }

                    let inputValues: Record<string, unknown> | undefined;
                    if (input.parameters && !task.parameters?.length) {
                        throw new Error(
                            "Task has no parameter schema. Remove parameters or define a schema on the task."
                        );
                    }
                    if (task.parameters?.length) {
                        const values = input.parameters ?? {};
                        const error = taskParameterValidate(task.parameters, values);
                        if (error) {
                            throw new Error(error);
                        }
                        inputValues = taskParameterInputsNormalize(task.parameters, values);
                    }

                    const target = input.agentId
                        ? { agentId: input.agentId }
                        : { descriptor: { type: "task" as const, id: task.id } };
                    const text = ["[task]", `taskId: ${task.id}`, `taskTitle: ${task.title}`].join("\n");

                    if (input.sync === true) {
                        const result = await this.taskExecutions.dispatchAndAwait({
                            userId: task.userId,
                            source: "manual",
                            taskId: task.id,
                            taskVersion: task.version ?? null,
                            origin: "task",
                            target,
                            text,
                            parameters: inputValues,
                            sync: true
                        });
                        if (result.responseError) {
                            throw new Error(result.executionErrorText ?? "Task execution failed.");
                        }
                        return { output: result.responseText ?? "" };
                    }

                    this.taskExecutions.dispatch({
                        userId: task.userId,
                        source: "manual",
                        taskId: task.id,
                        taskVersion: task.version ?? null,
                        origin: "task",
                        target,
                        text,
                        parameters: inputValues
                    });
                    return { queued: true };
                },
                cronTriggerAdd: (ctx, taskId, input) =>
                    this.crons.addTrigger(ctx, {
                        taskId,
                        schedule: input.schedule,
                        timezone: input.timezone,
                        agentId: input.agentId,
                        parameters: input.parameters
                    }),
                cronTriggerRemove: (ctx, taskId) => this.crons.deleteTriggersForTask(ctx, taskId),
                webhookTriggerAdd: (ctx, taskId, input) =>
                    this.webhooks.addTrigger(ctx, {
                        taskId,
                        agentId: input.agentId
                    }),
                webhookTriggerRemove: (ctx, taskId) => this.webhooks.deleteTriggersForTask(ctx, taskId)
            },
            tokenStatsFetch: (_ctx, options) => this.storage.tokenStats.findAll(options),
            documents: this.storage.documents,
            connectorTargetResolve: (path) => this.connectorTargetResolve(path)
        });
        this.channels = new Channels({
            channels: this.storage.channels,
            channelMessages: this.storage.channelMessages,
            signals: this.signals,
            agentSystem: this.agentSystem,
            observationLog: this.storage.observationLog
        });
    }

    async start(): Promise<void> {
        logger.debug("start: Engine.start() beginning");
        await this.migrationReady;
        const ownerCtx = await this.agentSystem.ownerCtxEnsure();
        const ownerUserHome = this.agentSystem.userHomeForUserId(ownerCtx.userId);
        await userHomeEnsure(ownerUserHome);
        await memoryRootDocumentEnsure(ownerCtx, this.storage);
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
        await this.swarms.discover(ownerCtx.userId);

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
        this.modules.tools.register("core", documentSearchToolBuild());
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
        this.modules.tools.register("core", swarmCreateToolBuild(this.swarms));
        this.modules.tools.register("core", channelCreateToolBuild(this.channels));
        this.modules.tools.register("core", channelSendToolBuild(this.channels));
        this.modules.tools.register("core", channelHistoryToolBuild(this.channels));
        this.modules.tools.register("core", channelAddMemberToolBuild(this.channels));
        this.modules.tools.register("core", channelRemoveMemberToolBuild(this.channels));
        this.modules.tools.register("core", friendAddToolBuild(this.friends));
        this.modules.tools.register("core", friendRemoveToolBuild(this.friends));
        this.modules.tools.register("core", friendSendToolBuild());
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
        this.modules.tools.register("core", exposeCreateToolBuild(this.exposes));
        this.modules.tools.register("core", exposeRemoveToolBuild(this.exposes));
        this.modules.tools.register("core", exposeUpdateToolBuild(this.exposes));
        this.modules.tools.register("core", exposeListToolBuild(this.exposes));
        this.modules.tools.register("core", observationQueryToolBuild(this.storage.observationLog));
        this.modules.tools.register("core", documentReadToolBuild());
        this.modules.tools.register("core", documentWriteToolBuild());
        logger.debug(
            "register: Core tools registered: tasks, topology, user_profile_update, background, inference_summary, inference_classify, agent_reset, agent_compact, send_user_message, skill, session_history, permanent_agents, swarms, channels, image_generation, speech_generation, voice_list, media_analysis, mermaid_png, reaction, say, send_file, pdf_process, generate_signal, signal_events_csv, signal_subscribe, signal_unsubscribe"
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
        const taskExecutionSummary = this.taskExecutions.summary();

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
            taskExecutions: {
                summary: taskExecutionSummary,
                tasks: this.taskExecutions.listStats()
            },
            tools: []
        };
    }

    private async handleContextCommand(path: AgentPath, context: MessageContext): Promise<void> {
        const target = await this.connectorTargetResolve(path);
        if (!target) {
            return;
        }
        const connector = this.modules.connectors.get(target.connector);
        if (!connector?.capabilities.sendText) {
            return;
        }
        let usedTokens: number | null = null;
        try {
            const ctx = await this.pathContextResolve(path);
            const agentId = await this.agentSystem.agentIdForTarget(ctx, { path });
            const history = await agentHistoryLoad(this.storage, contextForAgent({ userId: ctx.userId, agentId }));
            usedTokens = history.length > 0 ? contextEstimateTokens(history) : null;
        } catch (error) {
            logger.warn({ connector: target.connector, error }, "error: Context command failed to estimate usage");
        }
        const contextLimit = this.config.current.settings.agents.emergencyContextLimit;
        const text = messageContextStatus({ usedTokens, contextLimit });
        try {
            await connector.sendMessage(target.targetId, {
                text,
                replyToMessageId: context.messageId
            });
        } catch (error) {
            logger.warn({ connector: target.connector, error }, "error: Context command failed to send response");
        }
    }

    private async handleCompactCommand(path: AgentPath, context: MessageContext): Promise<void> {
        const ctx = await this.pathContextResolve(path);
        const agentId = await this.agentSystem.agentIdForTarget(ctx, { path });
        await this.agentSystem.post(ctx, { agentId }, { type: "compact", context });
    }

    private async handleResetCommand(path: AgentPath, context: MessageContext): Promise<void> {
        const dropped = this.incomingMessages.dropForPath(path);
        if (dropped > 0) {
            logger.debug({ dropped }, "event: Dropped pending connector messages before reset");
        }
        const ctx = await this.pathContextResolve(path);
        const agentId = await this.agentSystem.agentIdForTarget(ctx, { path });
        await this.agentSystem.post(
            ctx,
            { agentId },
            { type: "reset", message: "Manual reset requested by the user.", context }
        );
    }

    private async handleStopCommand(path: AgentPath, context: MessageContext): Promise<void> {
        const target = await this.connectorTargetResolve(path);
        if (!target) {
            return;
        }
        const connector = this.modules.connectors.get(target.connector);
        if (!connector?.capabilities.sendText) {
            return;
        }
        const aborted = this.agentSystem.abortInferenceForTarget({ path });
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

    private async targetCanonicalize(target: ConnectorTarget): Promise<{ ctx: Context; path: AgentPath }> {
        return this.pathCanonicalize(target);
    }

    /**
     * Resolves runtime user context from an incoming path.
     * Expects: paths are rooted under /<userId>/... for user-scoped agents.
     */
    private async pathCanonicalize(path: AgentPath): Promise<{ ctx: Context; path: AgentPath }> {
        await this.migrationReady;
        const connectorPath = connectorPathResolve(path);
        if (!connectorPath) {
            const ctx = await this.pathContextResolve(path);
            return { ctx, path };
        }

        // Canonical connector paths already use internal user ids.
        const canonicalTarget = await this.connectorTargetResolve(path);
        if (canonicalTarget) {
            return {
                ctx: contextForUser({ userId: connectorPath.ownerId }),
                path
            };
        }

        // Connector callbacks may still arrive with external ids; normalize them.
        const lookupTargetIds = connectorPathLookupTargetIds(connectorPath);
        const existing = await connectorPathUserFindByTargets(this.storage, connectorPath.connector, lookupTargetIds);
        const primaryTargetId = lookupTargetIds[0];
        if (!primaryTargetId) {
            throw new Error(`Connector target is required for path: ${path}`);
        }
        const user =
            existing?.user ??
            (await this.storage.resolveUserByConnectorKey(
                userConnectorKeyCreate(connectorPath.connector, primaryTargetId)
            ));
        const canonicalPath = connectorPathCanonicalize(user.id, connectorPath.connector, connectorPath.targetId);
        return {
            ctx: contextForUser({ userId: user.id }),
            path: canonicalPath
        };
    }

    /**
     * Resolves runtime user context from an incoming path.
     * Expects: paths are rooted under /<userId>/... for user-scoped agents.
     */
    private async pathContextResolve(path: AgentPath) {
        await this.migrationReady;
        const userId = pathUserIdResolve(path);
        if (!userId) {
            throw new Error(`Path does not resolve to a user context: ${path}`);
        }
        return contextForUser({ userId });
    }

    private async connectorTargetResolve(path: AgentPath): Promise<{ connector: string; targetId: string } | null> {
        const connectorPath = connectorPathResolve(path);
        if (!connectorPath) {
            return null;
        }
        const user = await this.storage.users.findById(connectorPath.ownerId);
        if (!user) {
            return null;
        }
        const keyPrefix = `${connectorPath.connector}:`;
        if (connectorPath.targetId) {
            const exactKey = `${keyPrefix}${connectorPath.targetId}`;
            const exact = user.connectorKeys.find((entry) => entry.connectorKey === exactKey);
            if (exact) {
                return { connector: connectorPath.connector, targetId: connectorPath.targetId };
            }
            const legacyFallback = connectorPathLegacyTargetFallback(connectorPath.targetId);
            if (legacyFallback) {
                const fallbackKey = `${keyPrefix}${legacyFallback}`;
                const fallback = user.connectorKeys.find((entry) => entry.connectorKey === fallbackKey);
                if (fallback) {
                    return { connector: connectorPath.connector, targetId: legacyFallback };
                }
            }
        }
        const connectorKey = user.connectorKeys.find((entry) => entry.connectorKey.startsWith(keyPrefix));
        if (!connectorKey) {
            return null;
        }
        const targetId = connectorKey.connectorKey.slice(keyPrefix.length).trim();
        if (!targetId) {
            return null;
        }
        return { connector: connectorPath.connector, targetId };
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

const RESERVED_USER_SCOPE_SEGMENTS = new Set(["agent", "cron", "task", "subuser", "app"]);

type ConnectorPath = {
    ownerId: string;
    connector: string;
    targetId: string | null;
};

type ConnectorPathUser = NonNullable<Awaited<ReturnType<Storage["users"]["findByConnectorKey"]>>>;

function pathSegments(path: AgentPath): string[] {
    return String(path)
        .split("/")
        .filter((segment) => segment.length > 0);
}

function pathUserIdResolve(path: AgentPath): string | null {
    const segments = pathSegments(path);
    const first = segments[0]?.trim() ?? "";
    if (!first) {
        return null;
    }
    return first;
}

function connectorPathResolve(path: AgentPath): ConnectorPath | null {
    const segments = pathSegments(path);
    if (segments.length < 2) {
        return null;
    }
    const ownerId = segments[0]?.trim() ?? "";
    const connector = segments[1]?.trim() ?? "";
    if (!ownerId || !connector) {
        return null;
    }
    if (RESERVED_USER_SCOPE_SEGMENTS.has(connector)) {
        return null;
    }
    const targetSegments = segments
        .slice(2)
        .map((segment) => segment.trim())
        .filter(Boolean);
    const targetId = targetSegments.length > 0 ? targetSegments.join("/") : null;
    return { ownerId, connector, targetId };
}

async function connectorPathUserFindByTargets(
    storage: Storage,
    connector: string,
    targetIds: string[]
): Promise<{ user: ConnectorPathUser; targetId: string } | null> {
    for (const targetId of targetIds) {
        const connectorKey = userConnectorKeyCreate(connector, targetId);
        const user = await storage.users.findByConnectorKey(connectorKey);
        if (user) {
            return { user, targetId };
        }
    }
    return null;
}

function connectorPathLookupTargetIds(connectorPath: ConnectorPath): string[] {
    const targetIds: string[] = [];
    const targetId = connectorPath.targetId?.trim() ?? "";
    if (!targetId) {
        const ownerId = connectorPath.ownerId.trim();
        if (ownerId) {
            targetIds.push(ownerId);
        }
        return targetIds;
    }
    targetIds.push(targetId);
    const legacyFallback = connectorPathLegacyTargetFallback(targetId);
    if (legacyFallback && !targetIds.includes(legacyFallback)) {
        targetIds.push(legacyFallback);
    }
    return targetIds;
}

function connectorPathLegacyTargetFallback(targetId: string): string | null {
    const segments = targetId
        .split("/")
        .map((segment) => segment.trim())
        .filter(Boolean);
    const channelId = segments[0] ?? "";
    const senderUserId = segments[1] ?? "";
    if (!channelId || !senderUserId) {
        return null;
    }
    return channelId === senderUserId ? channelId : null;
}

function connectorPathCanonicalize(ownerId: string, connector: string, targetId: string | null): AgentPath {
    const base = agentPathConnector(ownerId, connector);
    if (!targetId) {
        return base;
    }
    const targetSegments = targetId
        .split("/")
        .map((segment) => segment.trim())
        .filter(Boolean);
    if (targetSegments.length === 0) {
        return base;
    }
    return agentPath(`${base}/${targetSegments.join("/")}`);
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

async function taskIdGenerateFromTitle(storage: Storage, ctx: Context, title: string): Promise<string> {
    const base = stringSlugify(title) || "task";
    let candidate = base;
    let suffix = 2;

    while (await storage.tasks.findAnyById(ctx, candidate)) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
    }

    return candidate;
}
