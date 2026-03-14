/**
 * Formats a next cron fire timestamp as relative human-readable time.
 * Returns "not scheduled" when no future run is available.
 */
export function tasksFormatNextRunRelative(nextRunAt: number | null, now: number): string {
    if (nextRunAt === null) {
        return "not scheduled";
    }

    const deltaMs = Math.max(0, nextRunAt - now);
    if (deltaMs < 1_000) {
        return "now";
    }

    const seconds = Math.ceil(deltaMs / 1_000);
    if (seconds < 60) {
        return `in ${seconds} ${unitLabel("second", seconds)}`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
        if (remainingSeconds === 0) {
            return `in ${minutes} ${unitLabel("minute", minutes)}`;
        }
        return `in ${minutes} ${unitLabel("minute", minutes)} ${remainingSeconds} ${unitLabel("second", remainingSeconds)}`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours < 24) {
        if (remainingMinutes === 0) {
            return `in ${hours} ${unitLabel("hour", hours)}`;
        }
        return `in ${hours} ${unitLabel("hour", hours)} ${remainingMinutes} ${unitLabel("minute", remainingMinutes)}`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) {
        return `in ${days} ${unitLabel("day", days)}`;
    }
    return `in ${days} ${unitLabel("day", days)} ${remainingHours} ${unitLabel("hour", remainingHours)}`;
}

function unitLabel(unit: string, value: number): string {
    return value === 1 ? unit : `${unit}s`;
}
