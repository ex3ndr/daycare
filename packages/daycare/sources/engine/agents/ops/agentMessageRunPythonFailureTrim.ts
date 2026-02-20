/**
 * Trims assistant text after the failed <run_python> block.
 * Expects: successfulExecutionCount is the number of completed blocks before the failure.
 * Returns null when no trim is needed.
 */
export function agentMessageRunPythonFailureTrim(text: string, successfulExecutionCount: number): string | null {
    if (successfulExecutionCount < 0) {
        return null;
    }
    const blockPattern = /<run_python(\s[^>]*)?>[\s\S]*?<\/run_python\s*>/gi;
    const blocks = [...text.matchAll(blockPattern)];
    const failedBlock = blocks[successfulExecutionCount];
    if (!failedBlock || failedBlock.index === undefined) {
        return null;
    }
    const failedBlockEnd = failedBlock.index + failedBlock[0].length;
    const trimmed = text.slice(0, failedBlockEnd);
    return trimmed === text ? null : trimmed;
}
