import { describe, expect, it } from "vitest";
import { rlmToolResultBuild } from "./rlmToolResultBuild.js";

describe("rlmToolResultBuild", () => {
    it("preserves short content", () => {
        const result = rlmToolResultBuild({ id: "call-1", name: "run_python" }, "ok", false);

        const text = toolMessageText(result);
        expect(text).toBe("ok");
        expect(result.typedResult.summary).toBe("ok");
    });

    it("truncates oversized content for tool message and summary", () => {
        const longText = `${"a".repeat(8_000)}${"b".repeat(12_000)}`;
        const result = rlmToolResultBuild({ id: "call-2", name: "run_python" }, longText, false);

        const text = toolMessageText(result);
        expect(text).toContain("chars truncated from python result");
        expect(result.typedResult.summary).toBe(text);
    });
});

function toolMessageText(result: ReturnType<typeof rlmToolResultBuild>): string {
    if (!Array.isArray(result.toolMessage.content)) {
        return "";
    }
    const textPart = result.toolMessage.content.find((part) => part.type === "text");
    return textPart?.type === "text" ? textPart.text : "";
}
