import { describe, expect, it } from "vitest";
import { inferenceValueStringify } from "./inferenceValueStringify.js";

describe("inferenceValueStringify", () => {
    it("returns trimmed string values", () => {
        expect(inferenceValueStringify("  hello  ", "task")).toBe("hello");
    });

    it("serializes non-string values as json", () => {
        expect(inferenceValueStringify({ text: "hello" }, "text")).toBe('{"text":"hello"}');
    });

    it("throws on empty string values", () => {
        expect(() => inferenceValueStringify("   ", "task")).toThrow("task is required.");
    });

    it("throws when value cannot be serialized", () => {
        expect(() => inferenceValueStringify(() => undefined, "text")).toThrow("text could not be serialized.");
    });
});
