/**
 * Formats a lastExecutedAt unix timestamp as a relative time string.
 * Returns "never" when timestamp is null.
 *
 * Expects: timestamp and now are in milliseconds.
 */
export function tasksFormatLastRun(lastExecutedAt: number | null, now: number): string {
    if (lastExecutedAt === null) {
        return "never";
    }
    const deltaMs = now - lastExecutedAt;
    if (deltaMs < 60_000) {
        return "just now";
    }
    const minutes = Math.floor(deltaMs / 60_000);
    if (minutes < 60) {
        return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
