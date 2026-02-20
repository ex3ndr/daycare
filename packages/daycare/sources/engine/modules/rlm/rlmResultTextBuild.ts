import type { RlmExecuteResult } from "./rlmExecute.js";

/**
 * Formats a successful run_python execution summary for tool-result delivery.
 * Expects: result is returned from rlmExecute or rlmRestore.
 */
export function rlmResultTextBuild(result: RlmExecuteResult): string {
    return [
        "Python execution completed.",
        `Tool calls: ${result.toolCallCount}`,
        result.printOutput.length > 0 ? `Print output:\n${result.printOutput.join("\n")}` : "Print output: (none)",
        `Output:\n${result.output.length > 0 ? result.output : "(empty)"}`
    ].join("\n\n");
}
