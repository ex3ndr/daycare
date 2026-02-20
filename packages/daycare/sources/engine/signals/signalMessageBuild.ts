import type { Signal } from "./signalTypes.js";

/**
 * Builds a stable system message payload for signal delivery.
 * Expects: signal.id and signal.type are non-empty.
 */
export function signalMessageBuild(signal: Signal): string {
    const source = signalSourceLabel(signal.source);
    const data = signal.data === undefined ? "null" : JSON.stringify(signal.data);

    return [
        "[signal]",
        `id: ${signal.id}`,
        `type: ${signal.type}`,
        `source: ${source}`,
        `createdAt: ${signal.createdAt}`,
        `data: ${data}`
    ].join("\n");
}

function signalSourceLabel(source: { type: string; id?: string }): string {
    return source.id ? `${source.type}:${source.id}` : source.type;
}
