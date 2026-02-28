import { describe, expect, it } from "vitest";
import { taskParameterPreambleStubs } from "./taskParameterCodegen.js";
import type { TaskParameter } from "./taskParameterTypes.js";

describe("taskParameterPreambleStubs", () => {
    it("generates stub for required string", () => {
        const params: TaskParameter[] = [{ name: "city", type: "string", nullable: false }];
        expect(taskParameterPreambleStubs(params)).toBe('city: str = ""');
    });

    it("generates stub for nullable integer", () => {
        const params: TaskParameter[] = [{ name: "count", type: "integer", nullable: true }];
        expect(taskParameterPreambleStubs(params)).toBe("count: int | None = None");
    });

    it("generates stub for required float", () => {
        const params: TaskParameter[] = [{ name: "rate", type: "float", nullable: false }];
        expect(taskParameterPreambleStubs(params)).toBe("rate: float = 0.0");
    });

    it("generates stub for boolean", () => {
        const params: TaskParameter[] = [{ name: "verbose", type: "boolean", nullable: false }];
        expect(taskParameterPreambleStubs(params)).toBe("verbose: bool = False");
    });

    it("generates stub for any with import", () => {
        const params: TaskParameter[] = [{ name: "data", type: "any", nullable: false }];
        expect(taskParameterPreambleStubs(params)).toBe("from typing import Any\ndata: Any = None");
    });

    it("generates multiple stubs", () => {
        const params: TaskParameter[] = [
            { name: "city", type: "string", nullable: false },
            { name: "count", type: "integer", nullable: true },
            { name: "rate", type: "float", nullable: false }
        ];
        expect(taskParameterPreambleStubs(params)).toBe('city: str = ""\ncount: int | None = None\nrate: float = 0.0');
    });

    it("generates multiple stubs with any import once", () => {
        const params: TaskParameter[] = [
            { name: "a", type: "any", nullable: false },
            { name: "b", type: "any", nullable: true }
        ];
        expect(taskParameterPreambleStubs(params)).toBe("from typing import Any\na: Any = None\nb: Any | None = None");
    });

    it("returns empty string for empty params", () => {
        expect(taskParameterPreambleStubs([])).toBe("");
    });
});
