import type { ObservationLogDbRecord } from "@/types";

export type ObservationLogFormatMode = "json" | "short" | "full";

/**
 * Formats observation log entries for LLM consumption.
 *
 * Modes:
 * - "json": each entry's data field as a JSON line
 * - "short": one-line per entry: [ISO timestamp] [type] message
 * - "full": multi-line per entry with all fields
 */
export function observationLogFormat(entries: ObservationLogDbRecord[], mode: ObservationLogFormatMode): string {
    if (entries.length === 0) {
        return "No observations found.";
    }

    switch (mode) {
        case "json":
            return entries.map((entry) => JSON.stringify(entry.data ?? null)).join("\n");
        case "short":
            return entries.map((entry) => formatShort(entry)).join("\n");
        case "full":
            return entries.map((entry) => formatFull(entry)).join("\n\n");
    }
}

function formatShort(entry: ObservationLogDbRecord): string {
    const time = new Date(entry.createdAt).toISOString();
    return `[${time}] [${entry.type}] ${entry.message}`;
}

function formatFull(entry: ObservationLogDbRecord): string {
    const time = new Date(entry.createdAt).toISOString();
    const lines = [`[${time}] [${entry.type}] source=${entry.source}`, entry.message];

    if (entry.details) {
        lines.push(entry.details);
    }

    if (entry.data !== null && entry.data !== undefined) {
        lines.push(JSON.stringify(entry.data));
    }

    if (entry.scopeIds.length > 0) {
        lines.push(`scopes: ${entry.scopeIds.join(", ")}`);
    }

    return lines.join("\n");
}
