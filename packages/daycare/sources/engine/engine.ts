import { promises as fs } from "node:fs";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import Docker from "dockerode";

import type { AgentPath, Config, ConnectorMessage, ConnectorTarget, Context, MessageContext } from "@/types";
import { AppServer } from "../api/app-server/appServer.js";
import { AuthStore } from "../auth/store.js";
import { configLoad } from "../config/configLoad.js";
import { getLogger } from "../log.js";
import { getProviderDefinition } from "../providers/catalog.js";
import { ProviderManager } from "../providers/manager.js";
import { ModelRoles } from "../providers/modelRoles.js";
import { dockerContainersStaleRemove } from "../sandbox/docker/dockerContainersStaleRemove.js";
import { dockerImageIdResolve } from "../sandbox/docker/dockerImageIdResolve.js";
import { PsqlService } from "../services/psql/PsqlService.js";
import { psqlToolsBuild } from "../services/psql/psqlTools.js";
import { databaseClose } from "../storage/databaseClose.js";
import { databaseMigrate } from "../storage/databaseMigrate.js";
import { databaseOpen } from "../storage/databaseOpen.js";
import { Storage } from "../storage/storage.js";
import { stringSlugify } from "../utils/stringSlugify.js";
import { InvalidateSync } from "../utils/sync.js";
import { valueDeepEqual } from "../utils/valueDeepEqual.js";
import { AcpSessions } from "./acp/acpSessions.js";
import { AgentSystem } from "./agents/agentSystem.js";
import { contextForAgent, contextForUser } from "./agents/context.js";
import { agentHistoryLoad } from "./agents/ops/agentHistoryLoad.js";
import { agentPathApp, agentPathDirect, agentPathSupervisor, agentPathTask } from "./agents/ops/agentPathBuild.js";
import { agentPath } from "./agents/ops/agentPathTypes.js";
import { agentRecipientResolve } from "./agents/ops/agentRecipientResolve.js";
import { contextEstimateTokens } from "./agents/ops/contextEstimateTokens.js";
import { messageContextStatus } from "./agents/ops/messageContextStatus.js";
import { Channels } from "./channels/channels.js";
import { ConfigModule } from "./config/configModule.js";
import { Crons } from "./cron/crons.js";
import { FileFolder } from "./files/fileFolder.js";
import { Friends } from "./friends/friends.js";
import type { EngineEventBus } from "./ipc/events.js";
import { MemoryWorker } from "./memory/memoryWorker.js";
import { IncomingMessages } from "./messages/incomingMessages.js";
import { messageContextEnrichIncoming } from "./messages/messageContextEnrichIncoming.js";
import { MiniApps } from "./mini-apps/MiniApps.js";
import { miniAppCreateToolBuild } from "./mini-apps/miniAppCreateToolBuild.js";
import { miniAppDeleteToolBuild } from "./mini-apps/miniAppDeleteToolBuild.js";
import { miniAppEjectToolBuild } from "./mini-apps/miniAppEjectToolBuild.js";
import { miniAppUpdateToolBuild } from "./mini-apps/miniAppUpdateToolBuild.js";
import { messageContextRecipientResolve } from "./modules/connectors/messageContextRecipientResolve.js";
import { InferenceRouter } from "./modules/inference/router.js";
import { ModuleRegistry } from "./modules/moduleRegistry.js";
import { taskParameterInputsNormalize } from "./modules/tasks/taskParameterInputsNormalize.js";
import { taskParameterValidate } from "./modules/tasks/taskParameterValidate.js";
import { acpSessionMessageToolBuild } from "./modules/tools/acpSessionMessageToolBuild.js";
import { acpSessionStartToolBuild } from "./modules/tools/acpSessionStartToolBuild.js";
import { agentAskTool } from "./modules/tools/agentAskTool.js";
import { agentCompactToolBuild } from "./modules/tools/agentCompactTool.js";
import { agentModelSetToolBuild } from "./modules/tools/agentModelSetToolBuild.js";
import { agentResetToolBuild } from "./modules/tools/agentResetTool.js";
import { buildSendAgentMessageTool, buildStartBackgroundAgentTool } from "./modules/tools/background.js";
import { channelCreateToolBuild } from "./modules/tools/channelCreateTool.js";
import { channelHistoryToolBuild } from "./modules/tools/channelHistoryTool.js";
import { channelAddMemberToolBuild, channelRemoveMemberToolBuild } from "./modules/tools/channelMemberTool.js";
import { channelSendToolBuild } from "./modules/tools/channelSendTool.js";
import { documentAppendToolBuild } from "./modules/tools/documentAppendToolBuild.js";
import { documentPatchToolBuild } from "./modules/tools/documentPatchToolBuild.js";
import { documentReadToolBuild } from "./modules/tools/documentReadToolBuild.js";
import { documentSearchToolBuild } from "./modules/tools/documentSearchToolBuild.js";
import { documentTreeToolBuild } from "./modules/tools/documentTreeToolBuild.js";
import { documentWriteToolBuild } from "./modules/tools/documentWriteToolBuild.js";
import { fragmentArchiveToolBuild } from "./modules/tools/fragmentArchiveToolBuild.js";
import { fragmentCreateToolBuild } from "./modules/tools/fragmentCreateToolBuild.js";
import { fragmentListToolBuild } from "./modules/tools/fragmentListToolBuild.js";
import { fragmentReadToolBuild } from "./modules/tools/fragmentReadToolBuild.js";
import { fragmentUpdateToolBuild } from "./modules/tools/fragmentUpdateToolBuild.js";
import { friendAddToolBuild } from "./modules/tools/friendAddToolBuild.js";
import { friendRemoveToolBuild } from "./modules/tools/friendRemoveToolBuild.js";
import { friendSendToolBuild } from "./modules/tools/friendSendToolBuild.js";
import { buildImageGenerationTool } from "./modules/tools/image-generation.js";
import { inferenceClassifyToolBuild } from "./modules/tools/inference/inferenceClassifyToolBuild.js";
import { inferenceSummaryToolBuild } from "./modules/tools/inference/inferenceSummaryToolBuild.js";
import { buildMediaAnalysisTool } from "./modules/tools/media-analysis.js";
import { buildMermaidPngTool } from "./modules/tools/mermaid-png.js";
import { nowTool } from "./modules/tools/nowTool.js";
import { pdfProcessTool } from "./modules/tools/pdf-process.js";
import { permanentAgentToolBuild } from "./modules/tools/permanentAgentToolBuild.js";
import { buildReactionTool } from "./modules/tools/reaction.js";
import { sayTool } from "./modules/tools/sayTool.js";
import { secretAddToolBuild } from "./modules/tools/secretAddToolBuild.js";
import { secretRemoveToolBuild } from "./modules/tools/secretRemoveToolBuild.js";
import { secretCopyToolBuild } from "./modules/tools/secretsCopyToolBuild.js";
import { buildSendFileTool } from "./modules/tools/send-file.js";
import { sendUserMessageToolBuild } from "./modules/tools/sendUserMessageTool.js";
import { sessionHistoryToolBuild } from "./modules/tools/sessionHistoryToolBuild.js";
import { buildSignalGenerateTool } from "./modules/tools/signal.js";
import { signalEventsCsvToolBuild } from "./modules/tools/signalEventsCsvToolBuild.js";
import { buildSignalSubscribeTool } from "./modules/tools/signalSubscribeToolBuild.js";
import { buildSignalUnsubscribeTool } from "./modules/tools/signalUnsubscribeToolBuild.js";
import { skillAddToolBuild } from "./modules/tools/skillAddToolBuild.js";
import { skillEjectToolBuild } from "./modules/tools/skillEjectToolBuild.js";
import { skillRemoveToolBuild } from "./modules/tools/skillRemoveToolBuild.js";
import { skillToolBuild } from "./modules/tools/skillToolBuild.js";
import { buildSpeechGenerationTool } from "./modules/tools/speech-generation.js";
import { startBackgroundWorkflowToolBuild } from "./modules/tools/startBackgroundWorkflowTool.js";
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
import { taskCoreIdIs } from "./tasks/core/taskCoreIdIs.js";
import { taskSystemIdIs } from "./tasks/system/taskSystemIdIs.js";
import { taskSystemMemoryCompactorEnsure } from "./tasks/system/taskSystemMemoryCompactorEnsure.js";
import { taskDeleteSuccessResolve } from "./tasks/taskDeleteSuccessResolve.js";
import { TaskExecutionRunner } from "./tasks/taskExecutionRunner.js";
import { TaskExecutions } from "./tasks/taskExecutions.js";
import { taskListActive } from "./tasks/taskListActive.js";
import { taskListAll } from "./tasks/taskListAll.js";
import { userDocumentsEnsure } from "./users/userDocumentsEnsure.js";
import { userHomeEnsure } from "./users/userHomeEnsure.js";
import { Webhooks } from "./webhook/webhooks.js";
import { workspaceCreateToolBuild } from "./workspaces/workspaceCreateToolBuild.js";
import { Workspaces } from "./workspaces/workspaces.js";

const logger = getLogger("engine.runtime");
const DAYCARE_RUNTIME_IMAGE_REF = "daycare-runtime:latest";
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
    readonly psqlService: PsqlService;
    readonly agentSystem: AgentSystem;
    readonly crons: Crons;
    readonly webhooks: Webhooks;
    readonly appServer: AppServer;
    readonly signals: Signals;
    readonly delayedSignals: DelayedSignals;
    readonly taskExecutions: TaskExecutions;
    readonly channels: Channels;
    readonly acpSessions: AcpSessions;
    readonly processes: Processes;
    readonly inferenceRouter: InferenceRouter;
    readonly modelRoles: ModelRoles;
    readonly eventBus: EngineEventBus;
    readonly workspaces: Workspaces;
    readonly miniApps: MiniApps;
    readonly secrets: Secrets;
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
        this.psqlService = new PsqlService({
            usersDir: this.config.current.usersDir,
            databases: this.storage.psqlDatabases
        });
        this.miniApps = new MiniApps({
            usersDir: this.config.current.usersDir,
            storage: this.storage
        });
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
        this.acpSessions = new AcpSessions(getLogger("engine.acp"));
        this.processes = new Processes(this.config.current.dataDir, getLogger("engine.processes"), {
            repository: this.storage.processes,
            docker: this.config.current.docker,
            sandboxResourceLimits: this.config.current.settings.sandbox.resourceLimits
        });
        this.incomingMessages = new IncomingMessages({
            delayMs: INCOMING_MESSAGES_DEBOUNCE_MS,
            onFlush: async (items) => {
                await this.runConnectorCallback("message", async () => {
                    for (const item of items) {
                        const resolved = await this.pathCanonicalize(item.path, item.context);
                        logger.debug(
                            `receive: Connector message received: path=${resolved.path} merged=${item.count} text=${item.message.text?.length ?? 0}chars files=${item.message.files?.length ?? 0}`
                        );
                        const recipient = messageContextRecipientResolve(item.context);
                        await this.agentSystem.post(
                            resolved.ctx,
                            { path: resolved.path },
                            { type: "message", message: item.message, context: item.context },
                            {
                                kind: "connector",
                                foreground: true,
                                connector: recipient ?? null
                            }
                        );
                    }
                });
            }
        });
        logger.debug(`init: AuthStore initialized`);
        this.modules = new ModuleRegistry({
            onMessage: async (message, context, target) =>
                this.runConnectorCallback("message", async () => {
                    const resolved = await this.targetCanonicalize(target, context);
                    const ctx = resolved.ctx;
                    const messageContext = await this.messageContextWithTimezone(ctx, context);
                    const normalized = await this.messageFilesToDownloads(ctx, message);
                    this.incomingMessages.post({ path: resolved.path, message: normalized, context: messageContext });
                }),
            onCommand: async (command, context, target) =>
                this.runConnectorCallback("command", async () => {
                    const resolved = await this.targetCanonicalize(target, context);
                    const messageContext = await this.messageContextWithTimezone(resolved.ctx, context);
                    const connectorTarget =
                        messageContextRecipientResolve(messageContext) ??
                        (await this.connectorRecipientResolve(resolved.path));
                    const isConnector = connectorTarget !== null;
                    const connector = connectorTarget?.name ?? "unknown";
                    const parsed = parseCommand(command);
                    if (!parsed) {
                        return;
                    }
                    if (parsed.name === "reset") {
                        if (!isConnector) {
                            return;
                        }
                        logger.info({ connector, path: resolved.path }, "receive: Reset command received");
                        await this.handleResetCommand(resolved.ctx, resolved.path, messageContext);
                        return;
                    }
                    if (parsed.name === "context") {
                        if (!isConnector) {
                            return;
                        }
                        logger.info({ connector, path: resolved.path }, "receive: Context command received");
                        await this.handleContextCommand(resolved.ctx, resolved.path, messageContext);
                        return;
                    }
                    if (parsed.name === "compact") {
                        if (!isConnector) {
                            return;
                        }
                        logger.info({ connector, path: resolved.path }, "receive: Compact command received");
                        await this.handleCompactCommand(resolved.ctx, resolved.path, messageContext);
                        return;
                    }
                    if (parsed.name === "abort") {
                        if (!isConnector) {
                            return;
                        }
                        logger.info({ connector, path: resolved.path }, "stop: Abort command received");
                        await this.handleStopCommand(resolved.ctx, resolved.path, messageContext);
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

        this.pluginRegistry = new PluginRegistry(this.modules, (path) => this.connectorRecipientResolve(path));

        this.pluginManager = new PluginManager({
            config: this.config,
            registry: this.pluginRegistry,
            auth: this.authStore,
            fileStore: stagingFileStore,
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
            fileStore: stagingFileStore,
            inferenceRegistry: this.modules.inference,
            imageRegistry: this.modules.images
        });
        this.secrets = new Secrets({
            usersDir: this.config.current.usersDir,
            observationLog: this.storage.observationLog
        });
        this.modelRoles = new ModelRoles({
            repository: this.storage.modelRoleRules
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
            delayedSignals: this.delayedSignals,
            modelRoles: this.modelRoles,
            psqlService: this.psqlService
        });
        this.friends = new Friends({
            storage: this.storage,
            postToUserAgents: (userId, item) => this.agentSystem.postToUserAgents(userId, item)
        });
        this.workspaces = new Workspaces({
            storage: this.storage,
            userHomeForUserId: (userId) => this.agentSystem.userHomeForUserId(userId)
        });
        this.agentSystem.setExtraMountsForUserId((userId) => this.workspaces.mountsForOwner(userId));

        this.memoryWorker.setPostFn((ctx, target, item, creationConfig) =>
            this.agentSystem.post(ctx, target, item, creationConfig)
        );
        const taskExecutionRunner = new TaskExecutionRunner({
            agentSystem: this.agentSystem
        });
        this.taskExecutions = new TaskExecutions({
            runner: taskExecutionRunner
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
            db: this.storage.db,
            auth: this.authStore,
            commandRegistry: this.modules.commands,
            connectorRegistry: this.modules.connectors,
            toolResolver: this.modules.tools,
            webhooks: this.webhooks,
            users: this.storage.users,
            workspaceMembers: this.storage.workspaceMembers,
            agentCallbacks: {
                agentList: async (ctx) => {
                    const records = await this.storage.agents.findByUserId(ctx.userId);
                    return records.map((record) => ({
                        agentId: record.id,
                        path: record.path,
                        kind: record.kind,
                        name: record.name,
                        description: record.description,
                        connector: record.connector,
                        foreground: record.foreground,
                        lifecycle: record.lifecycle,
                        createdAt: record.createdAt,
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
                agentHistoryLoadAfter: async (ctx, agentId, after, limit) => {
                    const normalizedAgentId = agentId.trim();
                    if (!normalizedAgentId) {
                        return [];
                    }
                    const agent = await this.storage.agents.findById(normalizedAgentId);
                    if (!agent || agent.userId !== ctx.userId) {
                        return [];
                    }
                    const records = await this.storage.history.findByAgentId(normalizedAgentId);
                    const filtered = records.filter((record) => record.at > after);
                    return limit === undefined ? filtered : filtered.slice(0, limit);
                },
                agentCreate: async (ctx, input) => {
                    const systemPrompt = input.systemPrompt.trim();
                    if (!systemPrompt) {
                        throw new Error("systemPrompt is required.");
                    }

                    const name = input.name?.trim() ? input.name.trim() : null;
                    const description = input.description?.trim() ? input.description.trim() : null;
                    const targetPath = agentPathApp(ctx.userId, createId());
                    const agentId = await this.agentSystem.agentIdForTarget(
                        ctx,
                        { path: targetPath },
                        {
                            kind: "app",
                            foreground: false,
                            name,
                            description,
                            systemPrompt
                        }
                    );
                    const created = await this.storage.agents.findById(agentId);
                    if (!created || created.userId !== ctx.userId) {
                        throw new Error("Failed to resolve created app agent.");
                    }
                    return {
                        agentId: created.id,
                        initializedAt: created.createdAt
                    };
                },
                agentKill: (ctx, agentId) => this.agentSystem.kill(ctx, agentId),
                agentPost: (ctx, target, item) => this.agentSystem.post(ctx, target, item),
                agentDirectResolve: async (ctx) => {
                    const directPath = agentPathDirect(ctx.userId, ctx.userId);
                    return this.agentSystem.agentIdForTarget(
                        ctx,
                        { path: directPath },
                        {
                            kind: "connector",
                            foreground: true,
                            name: "Direct"
                        }
                    );
                },
                agentSupervisorResolve: async (ctx) => {
                    const supervisorPath = agentPathSupervisor(ctx.userId);
                    return this.agentSystem.agentIdForTarget(
                        ctx,
                        { path: supervisorPath },
                        {
                            kind: "supervisor",
                            foreground: false,
                            name: "Supervisor",
                            description: "Supervises, executes, and delegates tasks."
                        }
                    );
                }
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
            tasksListAll: (ctx) => taskListAll({ storage: this.storage, ctx }),
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
                    if (taskCoreIdIs(normalizedTaskId)) {
                        throw new Error("Core tasks cannot be updated.");
                    }
                    if (taskSystemIdIs(normalizedTaskId)) {
                        throw new Error("System tasks cannot be updated.");
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
                    if (taskCoreIdIs(normalizedTaskId)) {
                        throw new Error("Core tasks cannot be deleted.");
                    }
                    if (taskSystemIdIs(normalizedTaskId)) {
                        throw new Error("System tasks cannot be deleted.");
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
                        : { path: agentPathTask(task.userId, task.id) };
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
                    taskSystemIdIs(taskId)
                        ? Promise.reject(new Error("System task triggers cannot be added manually."))
                        : this.crons.addTrigger(ctx, {
                              taskId,
                              schedule: input.schedule,
                              timezone: input.timezone,
                              agentId: input.agentId,
                              parameters: input.parameters
                          }),
                cronTriggerUpdate: async (ctx, taskId, triggerId, input) => {
                    const existing = await this.storage.cronTasks.findById(triggerId);
                    if (!existing || existing.userId !== ctx.userId || existing.taskId !== taskId) {
                        return null;
                    }
                    if (input.enabled !== undefined) {
                        await (input.enabled
                            ? this.crons.enableTask(ctx, triggerId)
                            : this.crons.disableTask(ctx, triggerId));
                    }
                    const updated = await this.storage.cronTasks.findById(triggerId);
                    return updated?.userId === ctx.userId && updated.taskId === taskId ? updated : null;
                },
                cronTriggerRemove: (ctx, taskId) =>
                    taskSystemIdIs(taskId)
                        ? Promise.reject(new Error("System task triggers cannot be removed."))
                        : this.crons.deleteTriggersForTask(ctx, taskId),
                webhookTriggerAdd: (ctx, taskId, input) =>
                    taskSystemIdIs(taskId)
                        ? Promise.reject(new Error("System task triggers cannot be added manually."))
                        : this.webhooks.addTrigger(ctx, {
                              taskId,
                              agentId: input.agentId
                          }),
                webhookTriggerRemove: (ctx, taskId) =>
                    taskSystemIdIs(taskId)
                        ? Promise.reject(new Error("System task triggers cannot be removed."))
                        : this.webhooks.deleteTriggersForTask(ctx, taskId)
            },
            tokenStatsFetch: (ctx, options) => this.storage.tokenStats.findMany(ctx, options),
            documents: this.storage.documents,
            fragments: this.storage.fragments,
            keyValues: this.storage.keyValues,
            miniApps: this.miniApps,
            psql: this.psqlService,
            observationLog: this.storage.observationLog,
            secrets: this.secrets,
            connectorRecipientResolve: (path) => this.connectorRecipientResolve(path)
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
        await this.workspaces.ensureSystem();
        const ownerCtx = await this.agentSystem.ownerCtxEnsure();
        const users = await this.storage.users.findMany();
        for (const user of users) {
            await userHomeEnsure(this.agentSystem.userHomeForUserId(user.id));
            await userDocumentsEnsure(contextForUser({ userId: user.id }), this.storage, {
                soulBody: user.isWorkspace && user.systemPrompt ? `${user.systemPrompt}\n` : undefined
            });
        }
        const docker = this.config.current.docker.socketPath
            ? new Docker({ socketPath: this.config.current.docker.socketPath })
            : new Docker();
        try {
            await dockerImageIdResolve(docker);
        } catch (error) {
            throw new Error(
                `Required Docker image ${DAYCARE_RUNTIME_IMAGE_REF} is missing. Build or pull it before starting Daycare.`,
                { cause: error }
            );
        }
        try {
            await dockerContainersStaleRemove(docker, DAYCARE_RUNTIME_IMAGE_REF);
        } catch (error) {
            logger.warn(
                { imageRef: DAYCARE_RUNTIME_IMAGE_REF, error },
                "stale: Failed to remove stale Docker sandbox containers on startup"
            );
        }
        await this.workspaces.discover(ownerCtx.userId);

        logger.debug("load: Loading model role rules");
        await this.modelRoles.load();
        logger.debug("load: Model role rules loaded");

        logger.debug("load: Loading agents");
        await this.agentSystem.load();
        logger.debug("load: Agents loaded");
        await taskSystemMemoryCompactorEnsure(this.storage, this.agentSystem);

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

        logger.debug("register: Registering core tools");
        this.modules.tools.register("core", buildTaskCreateTool());
        this.modules.tools.register("core", buildTaskReadTool());
        this.modules.tools.register("core", buildTaskUpdateTool());
        this.modules.tools.register("core", buildTaskDeleteTool());
        this.modules.tools.register("core", buildTaskRunTool());
        this.modules.tools.register("core", buildTaskTriggerAddTool());
        this.modules.tools.register("core", buildTaskTriggerRemoveTool());
        this.modules.tools.register("core", buildStartBackgroundAgentTool());
        this.modules.tools.register("core", startBackgroundWorkflowToolBuild());
        this.modules.tools.register("core", buildSendAgentMessageTool());
        this.modules.tools.register("core", acpSessionStartToolBuild(this.acpSessions));
        this.modules.tools.register("core", acpSessionMessageToolBuild(this.acpSessions));
        this.modules.tools.register("core", agentAskTool());
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
        this.modules.tools.register("core", skillEjectToolBuild());
        this.modules.tools.register("core", secretAddToolBuild());
        this.modules.tools.register("core", secretRemoveToolBuild());
        this.modules.tools.register("core", secretCopyToolBuild());
        this.modules.tools.register("core", userProfileUpdateTool());
        this.modules.tools.register(
            "core",
            topologyTool(this.crons, this.signals, this.channels, this.secrets, this.acpSessions)
        );
        this.modules.tools.register("core", sessionHistoryToolBuild());
        this.modules.tools.register("core", permanentAgentToolBuild());
        this.modules.tools.register("core", workspaceCreateToolBuild(this.workspaces));
        this.modules.tools.register("core", miniAppCreateToolBuild(this.miniApps));
        this.modules.tools.register("core", miniAppUpdateToolBuild(this.miniApps));
        this.modules.tools.register("core", miniAppDeleteToolBuild(this.miniApps));
        this.modules.tools.register("core", miniAppEjectToolBuild(this.miniApps));
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
        this.modules.tools.register("core", nowTool());
        this.modules.tools.register("core", sayTool());
        this.modules.tools.register("core", buildSendFileTool());
        this.modules.tools.register("core", pdfProcessTool());
        this.modules.tools.register("core", buildSignalGenerateTool(this.signals));
        this.modules.tools.register("core", signalEventsCsvToolBuild(this.signals));
        this.modules.tools.register("core", buildSignalSubscribeTool(this.signals));
        this.modules.tools.register("core", buildSignalUnsubscribeTool(this.signals));
        this.modules.tools.register("core", observationQueryToolBuild(this.storage.observationLog));
        this.modules.tools.register("core", documentReadToolBuild());
        this.modules.tools.register("core", documentTreeToolBuild());
        this.modules.tools.register("core", documentAppendToolBuild());
        this.modules.tools.register("core", documentPatchToolBuild());
        this.modules.tools.register("core", documentWriteToolBuild());
        this.modules.tools.register("core", fragmentCreateToolBuild());
        this.modules.tools.register("core", fragmentReadToolBuild());
        this.modules.tools.register("core", fragmentListToolBuild());
        this.modules.tools.register("core", fragmentUpdateToolBuild());
        this.modules.tools.register("core", fragmentArchiveToolBuild());
        for (const tool of psqlToolsBuild(this.psqlService)) {
            this.modules.tools.register("core", tool);
        }
        logger.debug(
            "register: Core tools registered: tasks, topology, user_profile_update, background, agent_ask, inference_summary, inference_classify, agent_reset, agent_compact, send_user_message, skill, session_history, permanent_agents, workspaces, channels, image_generation, speech_generation, voice_list, media_analysis, mermaid_png, reaction, now, say, send_file, pdf_process, generate_signal, signal_events_csv, signal_subscribe, signal_unsubscribe, vault_read, vault_tree, vault_append, vault_patch, vault_write, fragment_create, fragment_read, fragment_list, fragment_update, fragment_archive"
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
        await this.acpSessions.shutdown();
        this.processes.unload();
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

    private async handleContextCommand(ctx: Context, path: AgentPath, context: MessageContext): Promise<void> {
        const target = messageContextRecipientResolve(context) ?? (await this.connectorRecipientResolve(path));
        if (!target) {
            return;
        }
        const connector = this.modules.connectors.get(target.name);
        if (!connector?.capabilities.sendText) {
            return;
        }
        let usedTokens: number | null = null;
        try {
            const agentId = await this.agentSystem.existingAgentIdForTarget(
                ctx,
                { path },
                connectorCreationConfigResolve(context)
            );
            if (agentId) {
                const history = await agentHistoryLoad(this.storage, contextForAgent({ userId: ctx.userId, agentId }));
                usedTokens = history.length > 0 ? contextEstimateTokens(history) : null;
            }
        } catch (error) {
            logger.warn({ connector: target.name, error }, "error: Context command failed to estimate usage");
        }
        const contextLimit = this.config.current.settings.agents.emergencyContextLimit;
        const text = messageContextStatus({ usedTokens, contextLimit });
        try {
            await connector.sendMessage(target, {
                text,
                replyToMessageId: context.messageId
            });
        } catch (error) {
            logger.warn({ connector: target.name, error }, "error: Context command failed to send response");
        }
    }

    private async handleCompactCommand(ctx: Context, path: AgentPath, context: MessageContext): Promise<void> {
        const agentId = await this.agentSystem.existingAgentIdForTarget(
            ctx,
            { path },
            connectorCreationConfigResolve(context)
        );
        if (!agentId) {
            return;
        }
        await this.agentSystem.post(ctx, { agentId }, { type: "compact", context });
    }

    private async handleResetCommand(ctx: Context, path: AgentPath, context: MessageContext): Promise<void> {
        const dropped = this.incomingMessages.dropForPath(path);
        if (dropped > 0) {
            logger.debug({ dropped }, "event: Dropped pending connector messages before reset");
        }
        const agentId = await this.agentSystem.existingAgentIdForTarget(
            ctx,
            { path },
            connectorCreationConfigResolve(context)
        );
        if (!agentId) {
            return;
        }
        await this.agentSystem.post(
            ctx,
            { agentId },
            { type: "reset", message: "Manual reset requested by the user.", context }
        );
    }

    private async handleStopCommand(ctx: Context, path: AgentPath, context: MessageContext): Promise<void> {
        const target = messageContextRecipientResolve(context) ?? (await this.connectorRecipientResolve(path));
        if (!target) {
            return;
        }
        const connector = this.modules.connectors.get(target.name);
        if (!connector?.capabilities.sendText) {
            return;
        }
        const agentId = await this.agentSystem.existingAgentIdForTarget(
            ctx,
            { path },
            connectorCreationConfigResolve(context)
        );
        const aborted = agentId ? this.agentSystem.abortInferenceForTarget({ agentId }) : false;
        const text = aborted ? "Stopped current inference." : "No active inference to stop.";
        try {
            await connector.sendMessage(target, {
                text,
                replyToMessageId: context.messageId
            });
        } catch (error) {
            logger.warn({ connector: target.name, error }, "error: Stop command failed to send response");
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

    private async targetCanonicalize(
        target: ConnectorTarget,
        context: MessageContext
    ): Promise<{ ctx: Context; path: AgentPath }> {
        return this.pathCanonicalize(target, context);
    }

    /**
     * Resolves runtime user context from connector metadata and rewrites only the user scope of the route.
     * Expects: connector callbacks include a normalized connector object.
     */
    private async pathCanonicalize(
        path: AgentPath,
        context: Pick<MessageContext, "connector">
    ): Promise<{
        ctx: Context;
        path: AgentPath;
    }> {
        await this.migrationReady;
        const recipient = messageContextRecipientResolve(context);
        if (!recipient) {
            throw new Error("Connector callbacks require connector.");
        }
        const user = await this.storage.resolveUserByConnector(recipient);
        const existingForeground = await this.storage.agents.findForegroundByConnector(user.id, recipient);
        return {
            ctx: contextForUser({ userId: user.id }),
            path: existingForeground?.path ?? pathUserIdReplace(path, user.id)
        };
    }

    private async connectorRecipientResolve(path: AgentPath): Promise<NonNullable<MessageContext["connector"]> | null> {
        const agent = await this.storage.agents.findByPath(path);
        if (!agent) {
            return null;
        }
        return agentRecipientResolve({ connector: agent.connector });
    }

    /**
     * Resolves effective message timezone and stable enrichment tags for incoming messages.
     * Expects: ctx belongs to the current runtime user.
     */
    private async messageContextWithTimezone(ctx: Context, context: MessageContext): Promise<MessageContext> {
        const user = await this.storage.users.findById(ctx.userId);
        return messageContextEnrichIncoming({
            context,
            user
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

function pathSegments(path: AgentPath): string[] {
    return String(path)
        .split("/")
        .filter((segment) => segment.length > 0);
}

function pathUserIdReplace(path: AgentPath, userId: string): AgentPath {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
        throw new Error("userId is required");
    }
    const segments = pathSegments(path);
    if (segments.length === 0) {
        throw new Error(`Path does not resolve to a user context: ${path}`);
    }
    return agentPath(`/${[normalizedUserId, ...segments.slice(1)].join("/")}`);
}

function connectorCreationConfigResolve(context: Pick<MessageContext, "connector">):
    | {
          kind: "connector";
          foreground: true;
          connector: {
              name: string;
              key: string;
          };
      }
    | undefined {
    const recipient = messageContextRecipientResolve(context);
    if (!recipient) {
        return undefined;
    }
    return {
        kind: "connector",
        foreground: true,
        connector: recipient
    };
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
