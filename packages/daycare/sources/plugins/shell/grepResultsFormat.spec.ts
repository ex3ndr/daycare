import { describe, expect, it } from "vitest";
import { grepResultsFormat } from "./grepResultsFormat.js";

describe("grepResultsFormat", () => {
    it("formats match/context JSON rows as file:line:content", () => {
        const stdout = [
            JSON.stringify({
                type: "match",
                data: {
                    path: { text: "/workspace/src/app.ts" },
                    lines: { text: "const value = 1;\\n" },
                    line_number: 3
                }
            }),
            JSON.stringify({
                type: "context",
                data: {
                    path: { text: "/workspace/src/app.ts" },
                    lines: { text: "console.log(value);\\n" },
                    line_number: 4
                }
            })
        ].join("\n");

        const result = grepResultsFormat(stdout, "/workspace");
        expect(result.count).toBe(1);
        expect(result.text).toContain("src/app.ts:3:const value = 1;");
        expect(result.text).toContain("src/app.ts:4:console.log(value);");
    });

    it("returns no-match text when no parseable rows exist", () => {
        const result = grepResultsFormat("", "/workspace");
        expect(result.count).toBe(0);
        expect(result.text).toBe("No matches found.");
    });

    it("truncates output by max bytes", () => {
        const stdout = [
            JSON.stringify({
                type: "match",
                data: {
                    path: { text: "/workspace/a.ts" },
                    lines: { text: "line-1\\n" },
                    line_number: 1
                }
            }),
            JSON.stringify({
                type: "match",
                data: {
                    path: { text: "/workspace/b.ts" },
                    lines: { text: "line-2\\n" },
                    line_number: 2
                }
            })
        ].join("\n");

        const result = grepResultsFormat(stdout, "/workspace", 18);
        expect(result.truncated).toBe(true);
        expect(result.text).toContain("Output truncated");
    });
});
