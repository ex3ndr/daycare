/**
 * Formats a next cron fire timestamp in the local timezone by default.
 * Returns "not scheduled" when no future run is available.
 */
export function tasksFormatNextRun(nextRunAt: number | null, timezone?: string): string {
    if (nextRunAt === null) {
        return "not scheduled";
    }

    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: timezone,
        timeZoneName: "short"
    }).format(new Date(nextRunAt));
}
