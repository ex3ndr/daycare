import { Type } from "@sinclair/typebox";
import { describe, expect, it, vi } from "vitest";
import { montyPreambleBuild } from "../monty/montyPreambleBuild.js";
import { RLM_LIMITS } from "./rlmLimits.js";
import { rlmStepStart } from "./rlmStepStart.js";

describe("rlmStepStart", () => {
    it("starts a VM and returns an immediate completion", () => {
        const printCallback = vi.fn();
        const result = rlmStepStart({
            code: "'done'",
            preamble: "",
            externalFunctions: [],
            limits: RLM_LIMITS,
            printCallback
        });

        expect(result.monty).toBeDefined();
        expect("output" in result.progress).toBe(true);
    });

    it("uses preamble as type-check prefix only and does not execute it", () => {
        const printCallback = vi.fn();
        const result = rlmStepStart({
            code: "'done'",
            preamble: "print('prefix-ran')",
            externalFunctions: [],
            limits: RLM_LIMITS,
            printCallback
        });

        expect("output" in result.progress).toBe(true);
        expect(printCallback).not.toHaveBeenCalled();
    });

    it("returns a paused snapshot when the code calls an external function", () => {
        const printCallback = vi.fn();
        const tools = [
            {
                name: "echo",
                description: "Echo",
                parameters: Type.Object({ text: Type.String() }, { additionalProperties: false })
            }
        ];
        const preamble = montyPreambleBuild(tools);

        const result = rlmStepStart({
            code: "echo('hello')",
            preamble,
            externalFunctions: ["echo"],
            limits: RLM_LIMITS,
            printCallback
        });

        expect("functionName" in result.progress).toBe(true);
    });
});
