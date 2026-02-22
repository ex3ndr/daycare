import { describe, expect, it } from "vitest";

import { parseObservations } from "./parseObservations.js";

describe("parseObservations", () => {
    it("parses valid observations", () => {
        const xml =
            "<observations>\n<observation><text>Fact A</text><context>Ctx A</context></observation>\n<observation><text>Fact B</text><context>Ctx B</context></observation>\n</observations>";
        expect(parseObservations(xml)).toEqual([
            { text: "Fact A", context: "Ctx A" },
            { text: "Fact B", context: "Ctx B" }
        ]);
    });

    it("returns empty array when no tags", () => {
        expect(parseObservations("nothing here")).toEqual([]);
    });

    it("skips observations with empty text or context", () => {
        const xml =
            "<observations><observation><text>  </text><context>Ctx</context></observation><observation><text>Real</text><context>  </context></observation><observation><text>Kept</text><context>Useful summary</context></observation></observations>";
        expect(parseObservations(xml)).toEqual([{ text: "Kept", context: "Useful summary" }]);
    });

    it("trims whitespace from text and context", () => {
        const xml = "<observation><text>  spaced out  </text><context>  related context  </context></observation>";
        expect(parseObservations(xml)).toEqual([{ text: "spaced out", context: "related context" }]);
    });

    it("handles multiline text and context", () => {
        const xml = "<observation><text>line one\nline two</text><context>ctx one\nctx two</context></observation>";
        expect(parseObservations(xml)).toEqual([{ text: "line one\nline two", context: "ctx one\nctx two" }]);
    });

    it("skips observations missing required fields", () => {
        const xml =
            "<observations><observation><text>Only text</text></observation><observation><context>Only context</context></observation></observations>";
        expect(parseObservations(xml)).toEqual([]);
    });
});
