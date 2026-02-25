import { describe, expect, it } from "vitest";
import { inferenceSummaryParse } from "./inferenceSummaryParse.js";

describe("inferenceSummaryParse", () => {
    it("extracts text from summary tags", () => {
        const result = inferenceSummaryParse("prefix <summary>Hello world</summary> suffix");
        expect(result).toBe("Hello world");
    });

    it("returns full text when summary tags are missing", () => {
        const input = "No summary tags present";
        expect(inferenceSummaryParse(input)).toBe(input);
    });

    it("returns an empty string for empty summary tags", () => {
        expect(inferenceSummaryParse("<summary>   </summary>")).toBe("");
    });

    it("uses the first summary tag when multiple are present", () => {
        const input = "<summary>First</summary>\n<summary>Second</summary>";
        expect(inferenceSummaryParse(input)).toBe("First");
    });

    it("keeps nested content inside summary tags", () => {
        const input = "<summary>Result <class>alpha</class> details</summary>";
        expect(inferenceSummaryParse(input)).toBe("Result <class>alpha</class> details");
    });
});
