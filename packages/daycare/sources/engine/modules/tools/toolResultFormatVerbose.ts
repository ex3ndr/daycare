import type { ToolExecutionResult } from "@/types";
import { stringTruncate } from "../../../utils/stringTruncate.js";

/**
 * Formats tool execution results for verbose logging output.
 * Expects: result.toolMessage is a ToolResultMessage from the tool execution.
 */
export function toolResultFormatVerbose(result: ToolExecutionResult): string {
    if (result.toolMessage.isError) {
        const errorContent = result.toolMessage.content;
        const errorText =
            typeof errorContent === "string"
                ? stringTruncate(errorContent, 200)
                : stringTruncate(JSON.stringify(errorContent), 200);
        return `[error] ${errorText}`;
    }
    const content = result.toolMessage.content;
    const contentText = typeof content === "string" ? content : JSON.stringify(content);
    const truncated = stringTruncate(contentText, 300);
    return `[result] ${truncated}`;
}
