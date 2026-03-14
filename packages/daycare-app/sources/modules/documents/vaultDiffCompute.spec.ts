import { describe, expect, it } from "vitest";
import { vaultDiffCompute } from "./vaultDiffCompute";

describe("vaultDiffCompute", () => {
    it("returns unchanged lines for identical text", () => {
        const result = vaultDiffCompute("hello\nworld", "hello\nworld");
        expect(result).toEqual([
            { type: "unchanged", text: "hello" },
            { type: "unchanged", text: "world" }
        ]);
    });

    it("detects added lines", () => {
        const result = vaultDiffCompute("hello", "hello\nworld");
        expect(result).toEqual([
            { type: "unchanged", text: "hello" },
            { type: "added", text: "world" }
        ]);
    });

    it("detects removed lines", () => {
        const result = vaultDiffCompute("hello\nworld", "hello");
        expect(result).toEqual([
            { type: "unchanged", text: "hello" },
            { type: "removed", text: "world" }
        ]);
    });

    it("handles empty inputs", () => {
        const result = vaultDiffCompute("", "hello");
        expect(result).toEqual([{ type: "added", text: "hello" }]);
    });
});
