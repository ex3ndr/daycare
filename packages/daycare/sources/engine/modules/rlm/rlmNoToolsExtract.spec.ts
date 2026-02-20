import { describe, expect, it } from "vitest";

import { rlmNoToolsExtract } from "./rlmNoToolsExtract.js";

describe("rlmNoToolsExtract", () => {
    it("extracts code from run_python tags", () => {
        const extracted = rlmNoToolsExtract("before <run_python>print('hi')</run_python> after");
        expect(extracted).toEqual(["print('hi')"]);
    });

    it("extracts multiple run_python blocks in order", () => {
        const extracted = rlmNoToolsExtract("<run_python>first()</run_python> gap <run_python>second()</run_python>");
        expect(extracted).toEqual(["first()", "second()"]);
    });

    it("returns an empty list when run_python tags are missing", () => {
        expect(rlmNoToolsExtract("plain text")).toEqual([]);
    });

    it("returns an empty list for partial run_python tags", () => {
        expect(rlmNoToolsExtract("<run_python>print('hi')")).toEqual([]);
        expect(rlmNoToolsExtract("print('hi')</run_python>")).toEqual([]);
    });
});
