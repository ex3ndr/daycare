import { getLogger } from "../../log.js";
import type { Storage } from "../../storage/storage.js";

const logger = getLogger("engine.memory");

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_BATCH_SIZE = 10;

export type MemoryWorkerOptions = {
    storage: Storage;
    intervalMs?: number;
};

/**
 * Timer-based worker that polls for invalidated sessions and processes them.
 * Processing is a stub for now - the actual memory extraction will be added later.
 */
export class MemoryWorker {
    private readonly storage: Storage;
    private readonly intervalMs: number;
    private tickTimer: NodeJS.Timeout | null = null;
    private started = false;
    private stopped = false;

    constructor(options: MemoryWorkerOptions) {
        this.storage = options.storage;
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

            for (const session of sessions) {
                if (this.stopped) {
                    break;
                }
                const invalidatedAt = session.invalidatedAt;
                if (invalidatedAt === null) {
                    continue;
                }

                await this.processSession(session.id);

                const maxHistoryId = await this.storage.history.maxId(session.id);
                const processedUntil = maxHistoryId ?? invalidatedAt;
                const cleared = await this.storage.sessions.markProcessed(session.id, processedUntil, invalidatedAt);
                if (cleared) {
                    logger.debug(`event: Session processed sessionId=${session.id} processedUntil=${processedUntil}`);
                } else {
                    logger.debug(`event: Session re-invalidated during processing sessionId=${session.id}`);
                }
            }
        } finally {
            this.scheduleNextTick();
        }
    }

    /**
     * Stub for session processing. Will be replaced with actual memory extraction.
     */
    private async processSession(sessionId: string): Promise<void> {
        logger.debug(`event: Processing session sessionId=${sessionId} (stub)`);
    }
}
