/**
 * Checks whether a cron trigger id belongs to the reserved system-cron namespace.
 * Expects: any raw trigger id string.
 */
export function cronSystemIdIs(triggerId: string): boolean {
    const normalized = triggerId.trim();
    return normalized.startsWith("system:") && normalized.length > "system:".length;
}
