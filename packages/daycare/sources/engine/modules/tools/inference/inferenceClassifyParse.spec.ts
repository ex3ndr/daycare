import { describe, expect, it } from "vitest";
import { inferenceClassifyParse } from "./inferenceClassifyParse.js";

describe("inferenceClassifyParse", () => {
    it("parses summary and class when both tags are valid", () => {
        const input = "<summary>Customer requests a refund.</summary><class>negative</class>";
        expect(inferenceClassifyParse(input, ["positive", "negative", "neutral"])).toEqual({
            summary: "Customer requests a refund.",
            class: "negative"
        });
    });

    it("throws when parsed class is not in validClasses", () => {
        const input = "<summary>General status update.</summary><class>other</class>";
        expect(() => inferenceClassifyParse(input, ["positive", "negative", "neutral"])).toThrow(
            'Invalid class "other"'
        );
    });

    it("throws when class tags are missing", () => {
        const input = "<summary>General status update.</summary>";
        expect(() => inferenceClassifyParse(input, ["positive", "negative"])).toThrow(
            "Missing <class> tag in inference output."
        );
    });

    it("trims surrounding whitespace in both summary and class", () => {
        const input = "<summary>  Concise summary.  </summary>\n<class>  neutral </class>";
        expect(inferenceClassifyParse(input, ["neutral"])).toEqual({
            summary: "Concise summary.",
            class: "neutral"
        });
    });
});
