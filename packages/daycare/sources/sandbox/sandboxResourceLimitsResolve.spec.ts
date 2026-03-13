import { describe, expect, it } from "vitest";

import { sandboxResourceLimitsResolve } from "./sandboxResourceLimitsResolve.js";

describe("sandboxResourceLimitsResolve", () => {
    it("defaults to 4 cpu and 16Gi memory", () => {
        expect(sandboxResourceLimitsResolve()).toEqual({
            cpu: 4,
            memory: "16Gi",
            nanoCpus: 4_000_000_000,
            memoryBytes: 17_179_869_184
        });
    });

    it("parses decimal cpu and binary memory units", () => {
        expect(sandboxResourceLimitsResolve({ cpu: 1.5, memory: "2Gi" })).toEqual({
            cpu: 1.5,
            memory: "2Gi",
            nanoCpus: 1_500_000_000,
            memoryBytes: 2_147_483_648
        });
    });

    it("parses decimal memory units case-insensitively", () => {
        expect(sandboxResourceLimitsResolve({ memory: "16gb" }).memoryBytes).toBe(16_000_000_000);
    });

    it("rejects invalid cpu values", () => {
        expect(() => sandboxResourceLimitsResolve({ cpu: 0 })).toThrow("Sandbox CPU limit must be a positive number.");
    });

    it("rejects invalid memory values", () => {
        expect(() => sandboxResourceLimitsResolve({ memory: "many" })).toThrow("Sandbox memory limit is invalid: many");
    });
});
