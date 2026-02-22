import { describe, expect, it } from "vitest";
import { rlmResultTextBuild } from "./rlmResultTextBuild.js";

describe("rlmResultTextBuild", () => {
    it("formats a compact result without truncation", () => {
        const text = rlmResultTextBuild({
            output: "done",
            printOutput: ["hello"],
            toolCallCount: 1
        });

        expect(text).toContain("Python execution completed.");
        expect(text).toContain("Print output:\nhello");
        expect(text).toContain("Output:\ndone");
    });

    it("truncates oversized print output and output sections", () => {
        const text = rlmResultTextBuild({
            output: `${"a".repeat(100)}${"b".repeat(9_000)}`,
            printOutput: [`${"x".repeat(100)}${"y".repeat(9_000)}`],
            toolCallCount: 2
        });

        expect(text).toContain("chars truncated from print output");
        expect(text).toContain("chars truncated from output");
    });

    it("applies a total result-level truncation when body is still large", () => {
        const text = rlmResultTextBuild({
            output: `${"o".repeat(8_000)}`,
            printOutput: [`${"p".repeat(8_000)}`],
            toolCallCount: 3
        });

        expect(text).toContain("chars truncated from python result");
    });
});
