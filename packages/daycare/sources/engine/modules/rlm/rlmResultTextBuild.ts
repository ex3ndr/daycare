import { stringTruncateHeadTail } from "../../../utils/stringTruncateHeadTail.js";
import type { RlmExecuteResult } from "./rlmExecute.js";

const RLM_PRINT_OUTPUT_MAX_CHARS = 8_000;
const RLM_OUTPUT_MAX_CHARS = 8_000;
const RLM_RESULT_TEXT_MAX_CHARS = 16_000;

/**
 * Formats a successful run_python execution summary for tool-result delivery.
 * Expects: result is returned from rlmExecute or rlmRestore.
 */
export function rlmResultTextBuild(result: RlmExecuteResult): string {
    const printOutputText =
        result.printOutput.length > 0
            ? stringTruncateHeadTail(result.printOutput.join("\n"), RLM_PRINT_OUTPUT_MAX_CHARS, "print output")
            : "(none)";
    const outputText =
        result.output.length > 0 ? stringTruncateHeadTail(result.output, RLM_OUTPUT_MAX_CHARS, "output") : "(empty)";
    const text = [
        "Python execution completed.",
        `Tool calls: ${result.toolCallCount}`,
        `Print output:\n${printOutputText}`,
        `Output:\n${outputText}`
    ].join("\n\n");
    return stringTruncateHeadTail(text, RLM_RESULT_TEXT_MAX_CHARS, "python result");
}
