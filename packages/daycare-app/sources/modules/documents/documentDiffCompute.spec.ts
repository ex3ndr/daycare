import { describe, expect, it } from "vitest";
import { documentDiffCompute } from "./documentDiffCompute";

describe("documentDiffCompute", () => {
    it("returns unchanged lines for identical text", () => {
        const result = documentDiffCompute("hello\nworld", "hello\nworld");
        expect(result).toEqual([
            { type: "unchanged", text: "hello" },
            { type: "unchanged", text: "world" }
        ]);
    });

    it("detects added lines", () => {
        const result = documentDiffCompute("hello", "hello\nworld");
        expect(result).toEqual([
            { type: "unchanged", text: "hello" },
            { type: "added", text: "world" }
        ]);
    });

    it("detects removed lines", () => {
        const result = documentDiffCompute("hello\nworld", "hello");
        expect(result).toEqual([
            { type: "unchanged", text: "hello" },
            { type: "removed", text: "world" }
        ]);
    });

    it("handles empty inputs", () => {
        const result = documentDiffCompute("", "hello");
        expect(result).toEqual([{ type: "added", text: "hello" }]);
    });
});
