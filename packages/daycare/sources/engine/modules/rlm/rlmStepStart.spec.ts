import { Type } from "@sinclair/typebox";
import { describe, expect, it, vi } from "vitest";
import { montyRuntimePreambleBuild } from "../monty/montyRuntimePreambleBuild.js";
import { RLM_LIMITS } from "./rlmLimits.js";
import { rlmPreambleNormalize } from "./rlmPreambleNormalize.js";
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

    it("returns a paused snapshot when the code calls an external function", () => {
        const printCallback = vi.fn();
        const tools = [
            {
                name: "echo",
                description: "Echo",
                parameters: Type.Object({ text: Type.String() }, { additionalProperties: false })
            }
        ];
        const preamble = rlmPreambleNormalize(montyRuntimePreambleBuild(tools));

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
