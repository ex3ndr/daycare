import { describe, expect, it } from "vitest";
import { findEntriesFormat } from "./findEntriesFormat.js";

describe("findEntriesFormat", () => {
    it("formats absolute and relative entries to workspace-relative output", () => {
        const stdout = "/workspace/src/app.ts\n./README.md\n";
        const result = findEntriesFormat(stdout, "/workspace");
        expect(result.count).toBe(2);
        expect(result.text).toContain("src/app.ts");
        expect(result.text).toContain("README.md");
    });

    it("returns no-files text for empty output", () => {
        const result = findEntriesFormat("", "/workspace");
        expect(result.text).toBe("No files found.");
        expect(result.count).toBe(0);
    });

    it("truncates output by max bytes", () => {
        const stdout = "a.ts\nb.ts\nc.ts\n";
        const result = findEntriesFormat(stdout, "/workspace", 4);
        expect(result.truncated).toBe(true);
        expect(result.text).toContain("Output truncated");
    });
});
