import { describe, expect, it } from "vitest";
import { stringTruncateHeadTail } from "./stringTruncateHeadTail.js";

describe("stringTruncateHeadTail", () => {
    it("returns the original string when within limits", () => {
        expect(stringTruncateHeadTail("hello", 5)).toBe("hello");
        expect(stringTruncateHeadTail("hello", 10)).toBe("hello");
    });

    it("keeps head and tail with truncation separator", () => {
        const input = "abcdefghijklmnopqrstuvwxyz";
        const result = stringTruncateHeadTail(input, 6);

        expect(result.startsWith("abc")).toBe(true);
        expect(result.includes("chars truncated from output")).toBe(true);
        expect(result.endsWith("xyz")).toBe(true);
    });

    it("supports custom source labels in truncation separator", () => {
        const result = stringTruncateHeadTail("abcdefghij", 4, "stdout");
        expect(result).toContain("chars truncated from stdout");
    });
});
