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
  });

  it("converts union schemas exactly", () => {
    expect(montyPythonTypeFromSchema({ type: ["string", "null"] })).toBe("str | None");
    expect(montyPythonTypeFromSchema({ anyOf: [{ type: "integer" }, { type: "null" }] })).toBe("int | None");
    expect(montyPythonTypeFromSchema({ oneOf: [{ type: "string" }, { type: "number" }] })).toBe("str | float");
  });

  it("falls back to Any for unsupported schema shapes", () => {
    expect(montyPythonTypeFromSchema({})).toBe("Any");
    expect(montyPythonTypeFromSchema("x")).toBe("Any");
    expect(montyPythonTypeFromSchema(null)).toBe("Any");
  });
});
