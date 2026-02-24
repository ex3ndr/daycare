import { describe, expect, it } from "vitest";
import { lsEntriesFormat } from "./lsEntriesFormat.js";

describe("lsEntriesFormat", () => {
    it("sorts entries and removes . and ..", () => {
        const stdout = ".\n..\nbeta/\n.alpha\nzeta\n";
        const result = lsEntriesFormat(stdout, 10);
        expect(result.count).toBe(3);
        expect(result.text).toBe(".alpha\nbeta/\nzeta");
    });

    it("applies entry limit truncation notice", () => {
        const stdout = "a\nb\nc\n";
        const result = lsEntriesFormat(stdout, 2);
        expect(result.truncated).toBe(true);
        expect(result.text).toContain("Output truncated by limit");
    });

    it("returns empty directory text when no entries remain", () => {
        const result = lsEntriesFormat(".\n..\n", 10);
        expect(result.text).toBe("Directory is empty.");
        expect(result.count).toBe(0);
    });
});
