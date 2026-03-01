/**
 * Resolves final task deletion success after trigger cleanup may already remove the task.
 * Expects: `deletedDirect` is the direct delete result; `taskAfterCleanup` is the latest task read.
 */
export function taskDeleteSuccessResolve(deletedDirect: boolean, taskAfterCleanup: unknown | null): boolean {
    return deletedDirect || taskAfterCleanup === null;
}
