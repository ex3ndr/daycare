import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { AuthStore } from "../auth/store.js";
import { configResolve } from "../config/configResolve.js";
import { AgentSystem } from "../engine/agents/agentSystem.js";
import { ConfigModule } from "../engine/config/configModule.js";
import type { Crons } from "../engine/cron/crons.js";
import { EngineEventBus } from "../engine/ipc/events.js";
import { ConnectorRegistry } from "../engine/modules/connectorRegistry.js";
import { ImageGenerationRegistry } from "../engine/modules/imageGenerationRegistry.js";
import type { InferenceRouter } from "../engine/modules/inference/router.js";
import { MediaAnalysisRegistry } from "../engine/modules/mediaAnalysisRegistry.js";
import { ToolResolver } from "../engine/modules/toolResolver.js";
import type { PluginManager } from "../engine/plugins/manager.js";
import { DelayedSignals } from "../engine/signals/delayedSignals.js";
import { Signals } from "../engine/signals/signals.js";
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
export async function evalHarnessCreate(options: { inferenceRouter?: InferenceRouter } = {}): Promise<EvalHarness> {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-eval-"));
    const config = configResolve(
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

    const pluginManager = {
        getSystemPrompts: async () => [],
        listRegisteredSkills: () => []
    } as unknown as PluginManager;

    const agentSystem = new AgentSystem({
        config: configModule,
        eventBus,
        storage,
        connectorRegistry: new ConnectorRegistry({
            onMessage: async () => undefined
        }),
        imageRegistry: new ImageGenerationRegistry(),
        mediaRegistry: new MediaAnalysisRegistry(),
        toolResolver: new ToolResolver(),
        pluginManager,
        inferenceRouter: options.inferenceRouter ?? evalInferenceRouterDefaultBuild(),
        authStore: new AuthStore(config),
        delayedSignals
    });

    agentSystem.setCrons({
        listTasks: async () => []
    } as unknown as Crons);
    agentSystem.setWebhooks({} as Parameters<AgentSystem["setWebhooks"]>[0]);
    agentSystem.setSignals(signals);
    await agentSystem.load();
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
            await storage.connection.close();
            await evalTempDirRemove(dir);
        }
    };
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
