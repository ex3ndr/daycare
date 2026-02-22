import { describe, expect, it } from "vitest";

import type { ToolExecutionResult } from "@/types";
import { toolResultTruncate } from "./toolResultTruncate.js";

describe("toolResultTruncate", () => {
    it("appends truncation notice for long text blocks", () => {
        const longText = `${"a".repeat(10)}${"b".repeat(9_000)}`;
        const result: ToolExecutionResult = {
            toolMessage: {
                role: "toolResult",
                toolCallId: "tool-1",
                toolName: "exec",
                content: [{ type: "text", text: longText }],
                isError: false,
                timestamp: Date.now()
            },
            typedResult: { text: longText }
        };

        const truncated = toolResultTruncate(result);
        const content = truncated.toolMessage.content as Array<{ type: "text"; text: string }>;
        const text = content[0]?.text ?? "";
        expect(text).not.toBe(longText);
        expect(text).toContain("chars truncated from output");
        expect(text.endsWith("b".repeat(8_000))).toBe(true);
    });

    it("returns original result for short text", () => {
        const result: ToolExecutionResult = {
            toolMessage: {
                role: "toolResult",
                toolCallId: "tool-1",
                toolName: "exec",
                content: [{ type: "text", text: "ok" }],
                isError: false,
                timestamp: Date.now()
            },
            typedResult: { text: "ok" }
        };

        const truncated = toolResultTruncate(result);
        expect(truncated).toBe(result);
    });

    it("truncates text blocks inside multi-block content", () => {
        const longText = `${"x".repeat(5)}${"y".repeat(9_000)}`;
        const result: ToolExecutionResult = {
            toolMessage: {
                role: "toolResult",
                toolCallId: "tool-1",
                toolName: "exec",
                content: [
                    { type: "text", text: "header" },
                    { type: "image", data: "abc", mimeType: "image/png" },
                    { type: "text", text: longText }
                ],
                isError: false,
                timestamp: Date.now()
            },
            typedResult: { text: longText }
        };

        const truncated = toolResultTruncate(result);
        const content = truncated.toolMessage.content as Array<{
            type: "text" | "image";
            text?: string;
            data?: string;
            mimeType?: string;
        }>;
        expect(content[0]).toEqual({ type: "text", text: "header" });
        expect(content[1]).toEqual({ type: "image", data: "abc", mimeType: "image/png" });
        expect(content[2]?.type).toBe("text");
        expect(content[2]?.text).toContain("chars truncated from output block");
        expect(content[2]?.text?.endsWith("y".repeat(8_000))).toBe(true);
    });
});
