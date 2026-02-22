import { describe, expect, it } from "vitest";

import { parseObservations } from "./parseObservations.js";

describe("parseObservations", () => {
    it("parses valid observations", () => {
        const xml =
            "<observations>\n<observation>Fact A</observation>\n<observation>Fact B</observation>\n</observations>";
        expect(parseObservations(xml)).toEqual([{ content: "Fact A" }, { content: "Fact B" }]);
    });

    it("returns empty array when no tags", () => {
        expect(parseObservations("nothing here")).toEqual([]);
    });

    it("skips empty observation tags", () => {
        const xml = "<observations><observation>  </observation><observation>Real</observation></observations>";
        expect(parseObservations(xml)).toEqual([{ content: "Real" }]);
    });

    it("trims whitespace from content", () => {
        const xml = "<observation>  spaced out  </observation>";
        expect(parseObservations(xml)).toEqual([{ content: "spaced out" }]);
    });

    it("handles multiline content", () => {
        const xml = "<observation>line one\nline two</observation>";
        expect(parseObservations(xml)).toEqual([{ content: "line one\nline two" }]);
    });
});
