import { getLogger } from "../../log.js";
import { listActiveInferenceProviders } from "../../providers/catalog.js";
import type { Storage } from "../../storage/storage.js";
import { Context } from "../agents/context.js";
import type { ConfigModule } from "../config/configModule.js";
import type { InferenceRouter } from "../modules/inference/router.js";
import { UserHome } from "../users/userHome.js";
import { memorySessionObserve } from "./memorySessionObserve.js";
import { observationLogAppend } from "./observationLogAppend.js";

const logger = getLogger("engine.memory");

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_BATCH_SIZE = 10;

export type MemoryWorkerOptions = {
    storage: Storage;
    inferenceRouter: InferenceRouter;
    config: ConfigModule;
    usersDir: string;
    intervalMs?: number;
};

/**
 * Timer-based worker that polls for invalidated sessions and processes them.
 * Runs inference to extract memory observations from conversation history.
 */
export class MemoryWorker {
    private readonly storage: Storage;
    private readonly inferenceRouter: InferenceRouter;
    private readonly config: ConfigModule;
    private readonly usersDir: string;
    private readonly intervalMs: number;
    private tickTimer: NodeJS.Timeout | null = null;
    private started = false;
    private stopped = false;

    constructor(options: MemoryWorkerOptions) {
        this.storage = options.storage;
        this.inferenceRouter = options.inferenceRouter;
        this.config = options.config;
        this.usersDir = options.usersDir;
        this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    }

    start(): void {
        if (this.started || this.stopped) {
            return;
        }
        this.started = true;
        logger.debug("start: MemoryWorker started");
        this.scheduleNextTick();
    }

    stop(): void {
        if (this.stopped) {
            return;
        }
        this.stopped = true;
        if (this.tickTimer) {
            clearTimeout(this.tickTimer);
            this.tickTimer = null;
        }
        logger.debug("stop: MemoryWorker stopped");
    }

    private scheduleNextTick(): void {
        if (this.stopped) {
            return;
        }
        this.tickTimer = setTimeout(() => {
            this.tickTimer = null;
            void this.tick().catch((error) => {
                logger.warn({ error }, "error: Memory worker tick failed");
            });
        }, this.intervalMs);
    }

    private async tick(): Promise<void> {
        if (this.stopped) {
            return;
        }

        try {
            const sessions = await this.storage.sessions.findInvalidated(DEFAULT_BATCH_SIZE);
            if (sessions.length > 0) {
                logger.debug(`event: Memory worker tick found ${sessions.length} invalidated session(s)`);
            }

            const providers = listActiveInferenceProviders(this.config.current.settings);

            for (const session of sessions) {
                if (this.stopped) {
                    break;
                }
                const invalidatedAt = session.invalidatedAt;
                if (invalidatedAt === null) {
                    continue;
                }

                const agent = await this.storage.agents.findById(session.agentId);
                if (!agent) {
                    logger.warn(
                        `event: Agent not found for session sessionId=${session.id} agentId=${session.agentId}`
                    );
                    continue;
                }

                const allSessions = await this.storage.sessions.findByAgentId(session.agentId);
                const sessionNumber = allSessions.findIndex((s) => s.id === session.id) + 1;
                const ctx = new Context(session.agentId, agent.userId);
                const processedUntil = session.processedUntil ?? 0;
                const records = await this.storage.history.findSinceId(session.id, processedUntil);

                const observations = await memorySessionObserve({
                    sessionNumber,
                    ctx,
                    records,
                    storage: this.storage,
                    inferenceRouter: this.inferenceRouter,
                    providers
                });

                const memoryDir = new UserHome(this.usersDir, agent.userId).memory;
                await observationLogAppend(memoryDir, observations);

                const maxHistoryId = await this.storage.history.maxId(session.id);
                const newProcessedUntil = maxHistoryId ?? invalidatedAt;
                const cleared = await this.storage.sessions.markProcessed(session.id, newProcessedUntil, invalidatedAt);
                if (cleared) {
                    logger.debug(`event: Session observed sessionId=${session.id} processedUntil=${newProcessedUntil}`);
                } else {
                    logger.debug(`event: Session re-invalidated during observation sessionId=${session.id}`);
                }
            }
        } finally {
            this.scheduleNextTick();
        }
    }
}
