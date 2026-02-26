import { Type } from "@sinclair/typebox";
import { describe, expect, it, vi } from "vitest";
import { montyPreambleBuild } from "../monty/montyPreambleBuild.js";
import { RLM_LIMITS } from "./rlmLimits.js";
import { rlmStepStart } from "./rlmStepStart.js";

describe("rlmStepStart", () => {
    it("starts a VM and returns an immediate completion", async () => {
        const printCallback = vi.fn();
        const result = await rlmStepStart({
            workerKey: "test:agent",
            code: "'done'",
            preamble: "",
            externalFunctions: [],
            limits: RLM_LIMITS,
            printCallback
        });

        expect("output" in result.progress).toBe(true);
    });

    it("uses preamble as type-check prefix only and does not execute it", async () => {
        const printCallback = vi.fn();
        const result = await rlmStepStart({
            workerKey: "test:agent",
            code: "'done'",
            preamble: "print('prefix-ran')",
            externalFunctions: [],
            limits: RLM_LIMITS,
            printCallback
        });

        expect("output" in result.progress).toBe(true);
        expect(printCallback).not.toHaveBeenCalled();
    });

    it("returns a paused snapshot when the code calls an external function", async () => {
        const printCallback = vi.fn();
        const tools = [
            {
                name: "echo",
                description: "Echo",
                parameters: Type.Object({ text: Type.String() }, { additionalProperties: false })
            }
        ];
        const preamble = montyPreambleBuild(tools);

        const result = await rlmStepStart({
            workerKey: "test:agent",
            code: "echo('hello')",
            preamble,
            externalFunctions: ["echo"],
            limits: RLM_LIMITS,
            printCallback
        });

        expect("functionName" in result.progress).toBe(true);
    });
});
