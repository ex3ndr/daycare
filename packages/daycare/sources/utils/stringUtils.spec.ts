import { describe, expect, it } from "vitest";

import { toCamelCase, toSafeFileName } from "./stringUtils.js";

describe("toCamelCase", () => {
    it("converts hyphenated strings", () => {
        expect(toCamelCase("hello-world")).toBe("helloWorld");
    });

    it("converts underscored strings", () => {
        expect(toCamelCase("hello_world")).toBe("helloWorld");
    });

    it("converts space-separated strings", () => {
        expect(toCamelCase("hello world")).toBe("helloWorld");
    });

    it("handles mixed separators", () => {
        expect(toCamelCase("hello-world_foo bar")).toBe("helloWorldFooBar");
    });

    it("handles uppercase input", () => {
        expect(toCamelCase("HELLO-WORLD")).toBe("helloWorld");
    });

    it("returns empty string for empty input", () => {
        expect(toCamelCase("")).toBe("");
    });

    it("handles single word", () => {
        expect(toCamelCase("hello")).toBe("hello");
    });

    it("strips special characters", () => {
        expect(toCamelCase("hello@world!")).toBe("helloworld");
    });
});

describe("toSafeFileName", () => {
    it("converts spaces to hyphens", () => {
        expect(toSafeFileName("hello world")).toBe("hello-world");
    });

    it("removes unsafe characters", () => {
        expect(toSafeFileName('file<>:"/\\|?*name')).toBe("filename");
    });

    it("converts to lowercase", () => {
        expect(toSafeFileName("Hello World")).toBe("hello-world");
    });

    it("collapses multiple hyphens", () => {
        expect(toSafeFileName("hello   world")).toBe("hello-world");
    });

    it("trims leading and trailing hyphens", () => {
        expect(toSafeFileName(" hello world ")).toBe("hello-world");
    });

    it("truncates long filenames", () => {
        const longName = "a".repeat(150);
        expect(toSafeFileName(longName).length).toBe(100);
    });

    it("handles empty string", () => {
        expect(toSafeFileName("")).toBe("");
    });
});
