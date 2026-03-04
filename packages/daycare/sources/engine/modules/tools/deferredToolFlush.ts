import type { DeferredToolHandler, ToolExecutionContext } from "@/types";
import { getLogger } from "../../../log.js";

const logger = getLogger("engine.deferred");

const DEFERRED_FLUSH_MAX_ATTEMPTS = 3;
const DEFERRED_FLUSH_RETRY_BASE_DELAY_MS = 200;

export type DeferredToolEntry = {
    toolName: string;
    payload: unknown;
    handler: DeferredToolHandler;
};

export type DeferredToolFlushResult = {
    sent: number;
    failed: number;
};

/**
 * Flushes accumulated deferred tool entries after successful script completion.
 * Each entry is flushed independently — one failure does not prevent others from sending.
 */
export async function deferredToolFlush(
    entries: DeferredToolEntry[],
    context: ToolExecutionContext
): Promise<DeferredToolFlushResult> {
    let sent = 0;
    let failed = 0;
    for (const entry of entries) {
        const ok = await deferredToolEntryFlushWithRetry(entry, context);
        if (ok) {
            sent++;
        } else {
            failed++;
        }
    }
    return { sent, failed };
}

/**
 * Builds a status line describing deferred message delivery outcome.
 * Returns empty string when there are no deferred entries.
 */
export function deferredToolStatusBuild(result: DeferredToolFlushResult | null, count: number): string {
    if (count === 0) {
        return "";
    }
    if (!result) {
        return `\n\n[Deferred messages: ${count} NOT sent (script failed)]`;
    }
    if (result.failed === 0) {
        return `\n\n[Deferred messages: ${result.sent} sent]`;
    }
    return `\n\n[Deferred messages: ${result.sent} sent, ${result.failed} failed]`;
}

async function deferredToolEntryFlushWithRetry(
    entry: DeferredToolEntry,
    context: ToolExecutionContext
): Promise<boolean> {
    for (let attempt = 1; attempt <= DEFERRED_FLUSH_MAX_ATTEMPTS; attempt += 1) {
        try {
            await entry.handler(entry.payload, context);
            return true;
        } catch (error) {
            const isLastAttempt = attempt === DEFERRED_FLUSH_MAX_ATTEMPTS;
            logger.warn(
                { tool: entry.toolName, attempt, maxAttempts: DEFERRED_FLUSH_MAX_ATTEMPTS, error },
                `error: Deferred send failed toolName=${entry.toolName}`
            );
            if (isLastAttempt) {
                return false;
            }
            await deferredFlushDelay(attempt);
        }
    }
    return false;
}

function deferredFlushDelay(attempt: number): Promise<void> {
    const delayMs = DEFERRED_FLUSH_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
    return new Promise((resolve) => {
        setTimeout(resolve, delayMs);
    });
}
