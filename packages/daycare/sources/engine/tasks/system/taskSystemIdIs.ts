/**
 * Checks whether a task id belongs to the reserved system-task namespace.
 * Expects: any raw task id string.
 */
export function taskSystemIdIs(taskId: string): boolean {
    const normalized = taskId.trim();
    return normalized.startsWith("system:") && normalized.length > "system:".length;
}
