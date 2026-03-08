import { describe, expect, it } from "vitest";
import { BASE_62_DIGITS, generateKeyBetween, generateNKeysBetween } from "./fractionalIndex.js";

describe("fractionalIndex", () => {
    describe("generateKeyBetween", () => {
        it("creates the first key between null bounds", () => {
            expect(generateKeyBetween(null, null)).toBe("a0");
        });

        it("creates a key between two existing keys", () => {
            expect(generateKeyBetween("a0", "a1")).toBe("a0V");
            expect(generateKeyBetween("a0V", "a1")).toBe("a0l");
        });

        it("handles lower and upper edge keys", () => {
            expect(generateKeyBetween(null, "a0")).toBe("Zz");
            expect(generateKeyBetween("zzzzzzzzzzzzzzzzzzzzzzzzzzz", null)).toBe("zzzzzzzzzzzzzzzzzzzzzzzzzzzV");
        });

        it("rejects invalid orderings", () => {
            expect(() => generateKeyBetween("a1", "a0")).toThrow("a1 >= a0");
        });
    });

    describe("generateNKeysBetween", () => {
        it("returns multiple sorted keys between bounds", () => {
            expect(generateNKeysBetween("a0", "a1", 3)).toEqual(["a0G", "a0V", "a0l"]);
        });

        it("generates keys when only an upper bound exists", () => {
            expect(generateNKeysBetween(null, "a0", 3)).toEqual(["Zx", "Zy", "Zz"]);
        });

        it("supports alternate digit alphabets", () => {
            const keys = generateNKeysBetween(null, null, 2, BASE_62_DIGITS);
            expect(keys).toEqual(["a0", "a1"]);
        });
    });
});
