/**
 * Converts a JSON-schema-like type fragment into a Python type hint.
 * Expects: schema shape follows tool parameter schema conventions.
 */
export function montyPythonTypeFromSchema(schema: unknown): string {
  if (!recordIs(schema)) {
    return "Any";
  }

  const anyOf = schema.anyOf;
  if (Array.isArray(anyOf) && anyOf.length > 0) {
    const union = anyOf
      .map((candidate) => montyPythonTypeFromSchema(candidate))
      .filter((candidate, index, all) => all.indexOf(candidate) === index);
    return union.length > 0 ? union.join(" | ") : "Any";
  }

  const oneOf = schema.oneOf;
  if (Array.isArray(oneOf) && oneOf.length > 0) {
    const union = oneOf
      .map((candidate) => montyPythonTypeFromSchema(candidate))
      .filter((candidate, index, all) => all.indexOf(candidate) === index);
    return union.length > 0 ? union.join(" | ") : "Any";
  }

  const type = schema.type;
  if (typeof type === "string") {
    if (type === "string") {
      return "str";
    }
    if (type === "integer") {
      return "int";
    }
    if (type === "number") {
      return "float";
    }
    if (type === "boolean") {
      return "bool";
    }
    if (type === "null") {
      return "None";
    }
    if (type === "array") {
      return `list[${montyPythonTypeFromSchema(schema.items)}]`;
    }
    if (type === "object") {
      return "dict[str, Any]";
    }
  }

  if (Array.isArray(type) && type.length > 0) {
    const union = type
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => montyPythonTypeFromSchema({ type: entry }))
      .filter((candidate, index, all) => all.indexOf(candidate) === index);
    return union.length > 0 ? union.join(" | ") : "Any";
  }

  return "Any";
}

function recordIs(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
