import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { AuthStore } from "../auth/store.js";
import { configResolve } from "../config/configResolve.js";
import { AgentSystem } from "../engine/agents/agentSystem.js";
import { Channels } from "../engine/channels/channels.js";
import { ConfigModule } from "../engine/config/configModule.js";
import { Crons } from "../engine/cron/crons.js";
import { engineToolsRegister } from "../engine/engineToolsRegister.js";
import { FileFolder } from "../engine/files/fileFolder.js";
import { Friends } from "../engine/friends/friends.js";
import { EngineEventBus } from "../engine/ipc/events.js";
import { MiniApps } from "../engine/mini-apps/MiniApps.js";
import { ConnectorRegistry } from "../engine/modules/connectorRegistry.js";
import { ImageGenerationRegistry } from "../engine/modules/imageGenerationRegistry.js";
import { InferenceRouter } from "../engine/modules/inference/router.js";
import { InferenceRegistry } from "../engine/modules/inferenceRegistry.js";
import { MediaAnalysisRegistry } from "../engine/modules/mediaAnalysisRegistry.js";
import { SpeechGenerationRegistry } from "../engine/modules/speechGenerationRegistry.js";
import { ToolResolver } from "../engine/modules/toolResolver.js";
import type { PluginManager } from "../engine/plugins/manager.js";
import { Secrets } from "../engine/secrets/secrets.js";
import { DelayedSignals } from "../engine/signals/delayedSignals.js";
import { Signals } from "../engine/signals/signals.js";
import { TaskExecutionRunner } from "../engine/tasks/taskExecutionRunner.js";
import { TaskExecutions } from "../engine/tasks/taskExecutions.js";
import { userDocumentsEnsure } from "../engine/users/userDocumentsEnsure.js";
import { userHomeEnsure } from "../engine/users/userHomeEnsure.js";
import { Webhooks } from "../engine/webhook/webhooks.js";
import { Workspaces } from "../engine/workspaces/workspaces.js";
import { ProviderManager } from "../providers/manager.js";
import { PsqlService } from "../services/psql/PsqlService.js";
import { readSettingsFile } from "../settings.js";
import type { Storage } from "../storage/storage.js";
import { storageOpenTest } from "../storage/storageOpenTest.js";

export type EvalHarness = {
    agentSystem: AgentSystem;
    storage: Storage;
    eventBus: EngineEventBus;
    cleanup: () => Promise<void>;
};

/**
 * Boots an in-process eval harness backed by in-memory PGlite and a mock inference router.
 * Expects: callers await cleanup() because temp runtime directories are created for user homes and auth files.
 */
export async function evalHarnessCreate(
    options: { inferenceRouter?: InferenceRouter; liveSettingsPath?: string } = {}
): Promise<EvalHarness> {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-eval-"));
    const config = options.liveSettingsPath
        ? await evalLiveConfigBuild(dir, options.liveSettingsPath)
        : configResolve(
              {
                  engine: {
                      dataDir: dir
                  },
                  providers: [{ id: "openai", model: "gpt-4.1" }]
              },
              path.join(dir, "settings.json")
          );
    const configModule = new ConfigModule(config);
    const storage = await storageOpenTest();
    const eventBus = new EngineEventBus();
    const signals = new Signals({
        eventBus,
        observationLog: storage.observationLog,
        signalEvents: storage.signalEvents,
        signalSubscriptions: storage.signalSubscriptions
    });
    const delayedSignals = new DelayedSignals({
        config: configModule,
        eventBus,
        signals,
        delayedSignals: storage.delayedSignals
    });
    await delayedSignals.ensureDir();
    const connectorRegistry = new ConnectorRegistry({
        onMessage: async () => undefined
    });
    const imageRegistry = new ImageGenerationRegistry();
    const speechRegistry = new SpeechGenerationRegistry();
    const mediaRegistry = new MediaAnalysisRegistry();
    const inferenceRegistry = new InferenceRegistry();
    const toolResolver = new ToolResolver();
    const psqlService = new PsqlService({
        usersDir: configModule.current.usersDir,
        databases: storage.psqlDatabases,
        databaseMode: "memory"
    });
    const secrets = new Secrets({
        usersDir: configModule.current.usersDir,
        observationLog: storage.observationLog
    });
    const authStore = new AuthStore(config);
    const liveProviderManager = options.liveSettingsPath
        ? new ProviderManager({
              config: configModule,
              auth: authStore,
              fileStore: new FileFolder(path.join(configModule.current.dataDir, "files")),
              inferenceRegistry,
              imageRegistry
          })
        : null;

    if (liveProviderManager) {
        await liveProviderManager.reload();
    }

    const pluginManager = {
        getSystemPrompts: async () => [],
        listRegisteredSkills: () => []
    } as unknown as PluginManager;

    const agentSystem = new AgentSystem({
        config: configModule,
        eventBus,
        storage,
        connectorRegistry,
        imageRegistry,
        mediaRegistry,
        toolResolver,
        pluginManager,
        inferenceRouter:
            options.inferenceRouter ??
            (liveProviderManager
                ? new InferenceRouter({
                      registry: inferenceRegistry,
                      auth: authStore,
                      config: configModule
                  })
                : evalInferenceRouterDefaultBuild()),
        authStore,
        delayedSignals,
        psqlService,
        secrets
    });
    const friends = new Friends({
        storage,
        postToUserAgents: (userId, item) => agentSystem.postToUserAgents(userId, item)
    });
    const workspaces = new Workspaces({
        storage,
        userHomeForUserId: (userId) => agentSystem.userHomeForUserId(userId)
    });
    agentSystem.setExtraMountsForUserId((userId) => workspaces.mountsForOwner(userId));
    const taskExecutions = new TaskExecutions({
        runner: new TaskExecutionRunner({
            agentSystem
        })
    });
    agentSystem.setTaskExecutions(taskExecutions);
    const crons = new Crons({
        config: configModule,
        storage,
        eventBus,
        agentSystem
    });
    const webhooks = new Webhooks({
        storage,
        agentSystem
    });
    const miniApps = new MiniApps({
        usersDir: configModule.current.usersDir,
        storage
    });
    const channels = new Channels({
        channels: storage.channels,
        channelMessages: storage.channelMessages,
        signals,
        agentSystem,
        observationLog: storage.observationLog
    });
    agentSystem.setCrons(crons);
    agentSystem.setWebhooks(webhooks);
    agentSystem.setSignals(signals);

    await workspaces.ensureSystem();
    const ownerCtx = await agentSystem.ownerCtxEnsure();
    await userHomeEnsure(agentSystem.userHomeForUserId(ownerCtx.userId));
    await userDocumentsEnsure(ownerCtx, storage);
    await workspaces.discover(ownerCtx.userId);
    await agentSystem.load();
    await channels.load();
    engineToolsRegister({
        toolResolver,
        inferenceRouter: agentSystem.inferenceRouter,
        config: configModule,
        crons,
        signals,
        channels,
        secrets,
        workspaces,
        miniApps,
        friends,
        imageRegistry,
        speechRegistry,
        mediaRegistry,
        psqlService,
        observationLog: storage.observationLog
    });
    await agentSystem.start();

    let cleaned = false;

    return {
        agentSystem,
        storage,
        eventBus,
        cleanup: async () => {
            if (cleaned) {
                return;
            }
            cleaned = true;
            delayedSignals.stop();
            crons.stop();
            webhooks.stop();
            await storage.connection.close();
            await evalTempDirRemove(dir);
        }
    };
}

async function evalLiveConfigBuild(dir: string, settingsPath: string) {
    const settings = await readSettingsFile(settingsPath);
    return configResolve(
        {
            ...settings,
            engine: {
                ...settings.engine,
                dataDir: dir
            }
        },
        settingsPath
    );
}

function evalInferenceRouterDefaultBuild(): InferenceRouter {
    return {
        complete: async () => ({
            providerId: "openai",
            modelId: "gpt-4.1",
            message: {
                role: "assistant",
                content: [{ type: "text", text: "ok" }],
                api: "openai-responses",
                provider: "openai",
                model: "gpt-4.1",
                usage: {
                    input: 10,
                    output: 5,
                    cacheRead: 0,
                    cacheWrite: 0,
                    totalTokens: 15,
                    cost: {
                        input: 0,
                        output: 0,
                        cacheRead: 0,
                        cacheWrite: 0,
                        total: 0
                    }
                },
                stopReason: "stop",
                timestamp: Date.now()
            }
        })
    } as unknown as InferenceRouter;
}

async function evalTempDirRemove(dir: string): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
            await rm(dir, { recursive: true, force: true });
            return;
        } catch (error) {
            const code = (error as NodeJS.ErrnoException).code;
            if (code !== "ENOTEMPTY" || attempt === 4) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
        }
    }
}
