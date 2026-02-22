import { describe, expect, it } from "vitest";
import { stringTruncateTail } from "./stringTruncateTail.js";

describe("stringTruncateTail", () => {
    it("returns the original string when within limits", () => {
        expect(stringTruncateTail("hello", 5)).toBe("hello");
        expect(stringTruncateTail("hello", 10)).toBe("hello");
    });

    it("keeps the tail and prepends truncation notice", () => {
        const input = "abcdefghijklmnopqrstuvwxyz";
        const result = stringTruncateTail(input, 5);

        expect(result).toContain("chars truncated from output");
        expect(result.endsWith("vwxyz")).toBe(true);
    });

    it("supports custom source labels in truncation notice", () => {
        const result = stringTruncateTail("abcdefghij", 3, "stderr");
        expect(result).toContain("chars truncated from stderr");
    });
});
