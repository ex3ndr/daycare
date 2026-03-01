import { getLogger } from "../../log.js";
import type { Storage } from "../../storage/storage.js";
import { type Context, contextForAgent } from "../agents/context.js";
import type { AgentDescriptor } from "../agents/ops/agentDescriptorTypes.js";
import type { ConfigModule } from "../config/configModule.js";
import { formatHistoryMessages } from "./infer/utils/formatHistoryMessages.js";
import { memoryRootDocumentEnsure } from "./memoryRootDocumentEnsure.js";

const logger = getLogger("engine.memory");

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_BATCH_SIZE = 10;

export type MemoryWorkerPostFn = (
    ctx: Context,
    target: { descriptor: AgentDescriptor },
    item: { type: "system_message"; text: string; origin: string }
) => Promise<void>;

export type MemoryWorkerOptions = {
    storage: Storage;
    config: ConfigModule;
    intervalMs?: number;
};

/**
 * Timer-based worker that polls for invalidated sessions and routes them
 * to per-agent memory-agents for observation extraction.
 */
export class MemoryWorker {
    private readonly storage: Storage;
    private readonly config: ConfigModule;
    private readonly intervalMs: number;
    private postToAgent: MemoryWorkerPostFn | null = null;
    private tickTimer: NodeJS.Timeout | null = null;
    private started = false;
    private stopped = false;

    constructor(options: MemoryWorkerOptions) {
        this.storage = options.storage;
        this.config = options.config;
        this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    }

    /**
     * Sets the posting function used to route transcripts to memory-agents.
     * Must be called before start().
     */
    setPostFn(fn: MemoryWorkerPostFn): void {
        this.postToAgent = fn;
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
        if (!this.postToAgent) {
            logger.warn("skip: Memory worker tick skipped — no postFn set");
            this.scheduleNextTick();
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

                const agent = await this.storage.agents.findById(session.agentId);
                if (!agent) {
                    logger.warn(
                        `event: Agent not found for session sessionId=${session.id} agentId=${session.agentId}`
                    );
                    continue;
                }

                // Skip sessions belonging to memory-agents and memory-search agents
                if (agent.descriptor.type === "memory-agent" || agent.descriptor.type === "memory-search") {
                    await this.storage.sessions.markProcessed(session.id, invalidatedAt, invalidatedAt);
                    continue;
                }

                const processedUntil = session.processedUntil ?? 0;
                const records = await this.storage.history.findSinceId(session.id, processedUntil);
                if (records.length === 0) {
                    await this.storage.sessions.markProcessed(session.id, invalidatedAt, invalidatedAt);
                    continue;
                }

                const isForeground = agent.descriptor.type === "user" || agent.descriptor.type === "subuser";
                const transcript = formatHistoryMessages(records, isForeground);
                if (transcript.trim().length === 0) {
                    await this.storage.sessions.markProcessed(session.id, invalidatedAt, invalidatedAt);
                    continue;
                }

                // Prepend memory update instruction so each batch reminds the
                // memory agent to persist any new knowledge found in the transcript.
                const preamble = isForeground
                    ? "> Review the following transcript and update memory documents with any new facts, relationships, or events. Do NOT reply with summaries — only use tools to update memory."
                    : "> Source: This transcript is from an automated agent performing background work. There is no human participant.\n> Review the following transcript and update memory documents with any new facts about what was done, what succeeded/failed, and what was learned about systems and processes. Do NOT reply with summaries — only use tools to update memory.";
                const text = `${preamble}\n\n${transcript}`;

                const descriptor: AgentDescriptor = { type: "memory-agent", id: session.agentId };
                const ctx = contextForAgent({ userId: agent.userId, agentId: session.agentId });
                await memoryRootDocumentEnsure(ctx, this.storage);
                await this.postToAgent(
                    ctx,
                    { descriptor },
                    {
                        type: "system_message",
                        text,
                        origin: `memory-worker:${session.id}`
                    }
                );

                const maxHistoryId = await this.storage.history.maxId(session.id);
                const newProcessedUntil = maxHistoryId ?? invalidatedAt;
                const cleared = await this.storage.sessions.markProcessed(session.id, newProcessedUntil, invalidatedAt);
                if (cleared) {
                    logger.debug(
                        `event: Session routed to memory-agent sessionId=${session.id} processedUntil=${newProcessedUntil}`
                    );
                } else {
                    logger.debug(`event: Session re-invalidated during routing sessionId=${session.id}`);
                }
            }
        } finally {
            this.scheduleNextTick();
        }
    }
}
