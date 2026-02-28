import { describe, expect, it } from "vitest";
import type { TaskParameter } from "./taskParameterTypes.js";
import { taskParameterValidate } from "./taskParameterValidate.js";

describe("taskParameterValidate", () => {
    it("returns null for valid required string", () => {
        const params: TaskParameter[] = [{ name: "city", type: "string", nullable: false }];
        expect(taskParameterValidate(params, { city: "Seoul" })).toBeNull();
    });

    it("returns null for valid required integer", () => {
        const params: TaskParameter[] = [{ name: "count", type: "integer", nullable: false }];
        expect(taskParameterValidate(params, { count: 42 })).toBeNull();
    });

    it("returns null for valid required float", () => {
        const params: TaskParameter[] = [{ name: "rate", type: "float", nullable: false }];
        expect(taskParameterValidate(params, { rate: 3.14 })).toBeNull();
    });

    it("accepts integer values for float type", () => {
        const params: TaskParameter[] = [{ name: "rate", type: "float", nullable: false }];
        expect(taskParameterValidate(params, { rate: 5 })).toBeNull();
    });

    it("rejects float values for integer type", () => {
        const params: TaskParameter[] = [{ name: "count", type: "integer", nullable: false }];
        expect(taskParameterValidate(params, { count: 3.14 })).toBe('Parameter "count" expects integer, got float.');
    });

    it("returns null for valid required boolean", () => {
        const params: TaskParameter[] = [{ name: "verbose", type: "boolean", nullable: false }];
        expect(taskParameterValidate(params, { verbose: true })).toBeNull();
    });

    it("returns null for valid any type", () => {
        const params: TaskParameter[] = [{ name: "data", type: "any", nullable: false }];
        expect(taskParameterValidate(params, { data: { nested: true } })).toBeNull();
    });

    it("returns error for missing required parameter", () => {
        const params: TaskParameter[] = [{ name: "city", type: "string", nullable: false }];
        expect(taskParameterValidate(params, {})).toBe('Required parameter "city" is missing.');
    });

    it("returns error for null required parameter", () => {
        const params: TaskParameter[] = [{ name: "city", type: "string", nullable: false }];
        expect(taskParameterValidate(params, { city: null })).toBe('Required parameter "city" is missing.');
    });

    it("returns null for missing nullable parameter", () => {
        const params: TaskParameter[] = [{ name: "city", type: "string", nullable: true }];
        expect(taskParameterValidate(params, {})).toBeNull();
    });

    it("returns null for null nullable parameter", () => {
        const params: TaskParameter[] = [{ name: "city", type: "string", nullable: true }];
        expect(taskParameterValidate(params, { city: null })).toBeNull();
    });

    it("returns error for wrong type (integer expected, string given)", () => {
        const params: TaskParameter[] = [{ name: "count", type: "integer", nullable: false }];
        expect(taskParameterValidate(params, { count: "five" })).toBe('Parameter "count" expects integer, got string.');
    });

    it("returns error for wrong type (float expected, string given)", () => {
        const params: TaskParameter[] = [{ name: "rate", type: "float", nullable: false }];
        expect(taskParameterValidate(params, { rate: "fast" })).toBe('Parameter "rate" expects float, got string.');
    });

    it("returns error for wrong type (string expected, number given)", () => {
        const params: TaskParameter[] = [{ name: "city", type: "string", nullable: false }];
        expect(taskParameterValidate(params, { city: 123 })).toBe('Parameter "city" expects string, got number.');
    });

    it("returns error for wrong type (boolean expected, string given)", () => {
        const params: TaskParameter[] = [{ name: "flag", type: "boolean", nullable: false }];
        expect(taskParameterValidate(params, { flag: "true" })).toBe('Parameter "flag" expects boolean, got string.');
    });

    it("accepts any value for any type", () => {
        const params: TaskParameter[] = [{ name: "data", type: "any", nullable: false }];
        expect(taskParameterValidate(params, { data: 42 })).toBeNull();
        expect(taskParameterValidate(params, { data: "hello" })).toBeNull();
        expect(taskParameterValidate(params, { data: true })).toBeNull();
        expect(taskParameterValidate(params, { data: [1, 2, 3] })).toBeNull();
    });

    it("validates multiple parameters", () => {
        const params: TaskParameter[] = [
            { name: "city", type: "string", nullable: false },
            { name: "count", type: "integer", nullable: true }
        ];
        expect(taskParameterValidate(params, { city: "Seoul", count: 5 })).toBeNull();
        expect(taskParameterValidate(params, { city: "Seoul" })).toBeNull();
        expect(taskParameterValidate(params, { count: 5 })).toBe('Required parameter "city" is missing.');
    });

    it("rejects unknown parameter keys", () => {
        const params: TaskParameter[] = [{ name: "city", type: "string", nullable: false }];
        expect(taskParameterValidate(params, { city: "Seoul", typo: "oops" })).toBe('Unknown parameter "typo".');
    });

    it("returns null for empty schema with empty values", () => {
        expect(taskParameterValidate([], {})).toBeNull();
    });

    it("rejects extra keys even with empty schema", () => {
        expect(taskParameterValidate([], { extra: "value" })).toBe('Unknown parameter "extra".');
    });
});
