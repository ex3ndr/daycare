import type { ToolExecutionResult } from "@/types";
import { stringTruncateTail } from "../../../utils/stringTruncateTail.js";

const MAX_TOOL_RESULT_CHARS = 8000;

/**
 * Truncates long tool result text payloads and appends a notice.
 * Expects: content is a string or block array with optional text parts.
 */
export function toolResultTruncate(result: ToolExecutionResult): ToolExecutionResult {
    const rawContent: unknown = result.toolMessage.content;
    if (typeof rawContent === "string") {
        const next = truncateText(rawContent, rawContent.length);
        if (next === rawContent) {
            return result;
        }
        return {
            ...result,
            toolMessage: {
                ...result.toolMessage,
                content: [{ type: "text", text: next }]
            }
        };
    }
    if (!Array.isArray(rawContent)) {
        return result;
    }
    const content = rawContent;

    const totalTextChars = content.reduce((sum, item) => {
        if (item.type !== "text") {
            return sum;
        }
        return sum + item.text.length;
    }, 0);
    let changed = false;

    const nextContent = content.map((item) => {
        if (item.type !== "text") {
            return item;
        }
        const nextText = truncateText(item.text, totalTextChars);
        if (nextText !== item.text) {
            changed = true;
            return { ...item, text: nextText };
        }
        return item;
    });

    if (!changed) {
        return result;
    }

    return {
        ...result,
        toolMessage: {
            ...result.toolMessage,
            content: nextContent
        }
    };
}

function truncateText(text: string, totalTextChars: number): string {
    if (text.length <= MAX_TOOL_RESULT_CHARS) {
        return text;
    }
    const blockSize = text.length.toLocaleString("en-US");
    const totalSize = totalTextChars.toLocaleString("en-US");
    const source =
        totalTextChars === text.length
            ? `output (${blockSize} chars total)`
            : `output block (${blockSize}/${totalSize})`;
    return stringTruncateTail(text, MAX_TOOL_RESULT_CHARS, source);
}
