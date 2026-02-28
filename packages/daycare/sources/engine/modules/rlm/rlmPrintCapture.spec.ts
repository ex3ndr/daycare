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

        rlmPrintCaptureAppendToolPrint(capture, "stdout", "debug info");
        rlmPrintCaptureFlushTrailing(capture);

        expect(lines).toEqual(["debug info"]);
    });

    it("ignores stderr tool print chunks", () => {
        const lines: string[] = [];
        const capture = rlmPrintCaptureCreate(lines);

        rlmPrintCaptureAppendToolPrint(capture, "stderr", "debug info");
        rlmPrintCaptureFlushTrailing(capture);

        expect(lines).toEqual([]);
    });

    it("supports newline chunking for tool stdout print chunks", () => {
        const lines: string[] = [];
        const capture = rlmPrintCaptureCreate(lines);

        rlmPrintCaptureAppendToolPrint(capture, "stdout", "alpha\nbeta");
        rlmPrintCaptureFlushTrailing(capture);

        expect(lines).toEqual(["alpha", "beta"]);
    });
});
