/**
 * Checks whether a task id belongs to the bundled core task namespace.
 * Expects: any raw task id string.
 */
export function taskCoreIdIs(taskId: string): boolean {
    const normalized = taskId.trim();
    return normalized.startsWith("core:") && normalized.length > "core:".length;
}
