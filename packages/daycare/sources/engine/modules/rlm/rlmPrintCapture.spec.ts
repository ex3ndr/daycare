import { describe, expect, it } from "vitest";

import {
    rlmPrintCaptureAppend,
    rlmPrintCaptureAppendToolPrint,
    rlmPrintCaptureCreate,
    rlmPrintCaptureFlushTrailing
} from "./rlmPrintCapture.js";

describe("rlmPrintCapture", () => {
    it("captures stdout chunks into finalized print lines", () => {
        const lines: string[] = [];
        const capture = rlmPrintCaptureCreate(lines);

        rlmPrintCaptureAppend(capture, ["stdout", "hello\nworld"]);
        rlmPrintCaptureFlushTrailing(capture);

        expect(lines).toEqual(["hello", "world"]);
    });

    it("ignores stderr output", () => {
        const lines: string[] = [];
        const capture = rlmPrintCaptureCreate(lines);

        rlmPrintCaptureAppend(capture, ["stderr", "boom"]);

        expect(lines).toEqual([]);
    });

    it("supports tool-style print calls with a single string argument", () => {
        const lines: string[] = [];
        const capture = rlmPrintCaptureCreate(lines);

        rlmPrintCaptureAppendToolPrint(capture, ["debug info"]);

        expect(lines).toEqual(["debug info"]);
    });

    it("supports tool-style print calls with multiple arguments", () => {
        const lines: string[] = [];
        const capture = rlmPrintCaptureCreate(lines);

        rlmPrintCaptureAppendToolPrint(capture, ["debug", 42, { ok: true }, null]);

        expect(lines).toEqual(['debug 42 {"ok":true}']);
    });

    it("treats stdout/stderr markers as literal tool print arguments", () => {
        const lines: string[] = [];
        const capture = rlmPrintCaptureCreate(lines);

        rlmPrintCaptureAppendToolPrint(capture, ["stderr", "x"]);
        rlmPrintCaptureAppendToolPrint(capture, ["stdout", "y"]);

        expect(lines).toEqual(["stderr x", "stdout y"]);
    });
});
