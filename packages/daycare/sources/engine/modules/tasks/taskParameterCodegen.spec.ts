import { describe, expect, it } from "vitest";
import { taskParameterPreambleStubs } from "./taskParameterCodegen.js";
import type { TaskParameter } from "./taskParameterTypes.js";

describe("taskParameterPreambleStubs", () => {
    it("generates stub for required string", () => {
        const params: TaskParameter[] = [{ name: "city", type: "string", nullable: false }];
        expect(taskParameterPreambleStubs(params)).toBe("city: str");
    });

    it("generates stub for nullable number", () => {
        const params: TaskParameter[] = [{ name: "count", type: "number", nullable: true }];
        expect(taskParameterPreambleStubs(params)).toBe("count: int | float | None");
    });

    it("generates stub for boolean", () => {
        const params: TaskParameter[] = [{ name: "verbose", type: "boolean", nullable: false }];
        expect(taskParameterPreambleStubs(params)).toBe("verbose: bool");
    });

    it("generates stub for any", () => {
        const params: TaskParameter[] = [{ name: "data", type: "any", nullable: false }];
        expect(taskParameterPreambleStubs(params)).toBe("data: Any");
    });

    it("generates multiple stubs", () => {
        const params: TaskParameter[] = [
            { name: "city", type: "string", nullable: false },
            { name: "count", type: "number", nullable: true }
        ];
        expect(taskParameterPreambleStubs(params)).toBe("city: str\ncount: int | float | None");
    });

    it("returns empty string for empty params", () => {
        expect(taskParameterPreambleStubs([])).toBe("");
    });
});
