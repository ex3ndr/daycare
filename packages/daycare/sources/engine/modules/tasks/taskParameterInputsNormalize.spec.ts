import { describe, expect, it } from "vitest";
import { taskParameterInputsNormalize } from "./taskParameterInputsNormalize.js";
import type { TaskParameter } from "./taskParameterTypes.js";

describe("taskParameterInputsNormalize", () => {
    it("returns values unchanged when all params provided", () => {
        const params: TaskParameter[] = [
            { name: "city", type: "string", nullable: false },
            { name: "count", type: "integer", nullable: false }
        ];
        const result = taskParameterInputsNormalize(params, { city: "Seoul", count: 5 });
        expect(result).toEqual({ city: "Seoul", count: 5 });
    });

    it("fills missing nullable param with null", () => {
        const params: TaskParameter[] = [
            { name: "city", type: "string", nullable: true },
            { name: "count", type: "integer", nullable: true }
        ];
        const result = taskParameterInputsNormalize(params, { city: "Seoul" });
        expect(result).toEqual({ city: "Seoul", count: null });
    });

    it("fills all missing params with null", () => {
        const params: TaskParameter[] = [
            { name: "a", type: "string", nullable: true },
            { name: "b", type: "float", nullable: true }
        ];
        const result = taskParameterInputsNormalize(params, {});
        expect(result).toEqual({ a: null, b: null });
    });

    it("does not overwrite explicitly provided null", () => {
        const params: TaskParameter[] = [{ name: "city", type: "string", nullable: true }];
        const result = taskParameterInputsNormalize(params, { city: null });
        expect(result).toEqual({ city: null });
    });

    it("returns empty object for empty params", () => {
        const result = taskParameterInputsNormalize([], {});
        expect(result).toEqual({});
    });

    it("does not mutate original values", () => {
        const params: TaskParameter[] = [{ name: "extra", type: "any", nullable: true }];
        const values = { extra: "value" };
        const result = taskParameterInputsNormalize(params, values);
        expect(result).toEqual({ extra: "value" });
        expect(values).toEqual({ extra: "value" });
    });

    it("strips keys not in schema", () => {
        const params: TaskParameter[] = [{ name: "city", type: "string", nullable: false }];
        const result = taskParameterInputsNormalize(params, { city: "Seoul", unknown: 42 });
        expect(result).toEqual({ city: "Seoul" });
    });
});
