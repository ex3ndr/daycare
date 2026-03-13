import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";

import { montyPythonTypeFromSchema } from "./montyPythonTypeFromSchema.js";

describe("montyPythonTypeFromSchema", () => {
    it("converts primitive schema types exactly", () => {
        expect(montyPythonTypeFromSchema({ type: "string" })).toBe("str");
        expect(montyPythonTypeFromSchema({ type: "integer" })).toBe("int");
        expect(montyPythonTypeFromSchema({ type: "number" })).toBe("float");
        expect(montyPythonTypeFromSchema({ type: "boolean" })).toBe("bool");
        expect(montyPythonTypeFromSchema({ type: "null" })).toBe("None");
    });

    it("converts array and object schemas exactly", () => {
        expect(montyPythonTypeFromSchema({ type: "array", items: { type: "string" } })).toBe("list[str]");
        expect(montyPythonTypeFromSchema({ type: "object", additionalProperties: false })).toBe("dict[str, Any]");
        expect(montyPythonTypeFromSchema(Type.Record(Type.String(), Type.Integer()))).toBe("dict[str, int]");
    });

    it("converts union schemas exactly", () => {
        expect(montyPythonTypeFromSchema({ type: ["string", "null"] })).toBe("str | None");
        expect(montyPythonTypeFromSchema({ anyOf: [{ type: "integer" }, { type: "null" }] })).toBe("int | None");
        expect(montyPythonTypeFromSchema({ oneOf: [{ type: "string" }, { type: "number" }] })).toBe("str | float");
    });

    it("treats explicit Any and Unknown schemas as Any", () => {
        expect(montyPythonTypeFromSchema(Type.Any())).toBe("Any");
        expect(montyPythonTypeFromSchema(Type.Unknown())).toBe("Any");
    });

    it("throws for unsupported schema shapes instead of falling back", () => {
        expect(() => montyPythonTypeFromSchema("x")).toThrow("Unsupported Monty schema at schema");
        expect(() => montyPythonTypeFromSchema(null)).toThrow("Unsupported Monty schema at schema");
        expect(() => montyPythonTypeFromSchema({ allOf: [{ type: "string" }, { type: "null" }] })).toThrow(
            "Unsupported Monty schema at schema.allOf"
        );
    });
});
