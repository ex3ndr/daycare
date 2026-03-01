import type { DeferredToolHandler, ToolExecutionContext } from "@/types";
import { getLogger } from "../../../log.js";

const logger = getLogger("engine.deferred");

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
        try {
            await entry.handler(entry.payload, context);
            sent++;
        } catch (error) {
            failed++;
            logger.warn({ tool: entry.toolName, error }, `error: Deferred send failed toolName=${entry.toolName}`);
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
