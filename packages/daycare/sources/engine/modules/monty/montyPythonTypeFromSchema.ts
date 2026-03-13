/**
 * Converts a JSON-schema-like type fragment into a Python type hint.
 * Expects: schema shape follows tool parameter schema conventions.
 */
export function montyPythonTypeFromSchema(schema: unknown): string {
    return typeFromSchema(schema, "schema");
}

function typeFromSchema(schema: unknown, path: string): string {
    if (!recordIs(schema)) {
        throw new Error(`Unsupported Monty schema at ${path}: expected an object schema.`);
    }

    if (schemaAnyIs(schema)) {
        return "Any";
    }

    const union = unionTypeResolve(schema, path);
    if (union) {
        return union;
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
            if (Array.isArray(schema.items)) {
                throw new Error(`Unsupported Monty schema at ${path}.items: tuple arrays are not supported.`);
            }
            return `list[${typeFromSchema(schema.items, `${path}.items`)}]`;
        }
        if (type === "object") {
            const valueSchema = objectValueSchemaResolve(schema);
            if (valueSchema) {
                return `dict[str, ${typeFromSchema(valueSchema, `${path}.*`)}]`;
            }
            return "dict[str, Any]";
        }
    }

    if (Array.isArray(type) && type.length > 0) {
        const unionTypes = type.map((entry, index) => {
            if (typeof entry !== "string") {
                throw new Error(`Unsupported Monty schema at ${path}.type[${index}]: expected a string type name.`);
            }
            return typeFromSchema({ type: entry }, `${path}.type[${index}]`);
        });
        return unionTypeJoin(unionTypes, path);
    }

    throw new Error(`Unsupported Monty schema at ${path}.`);
}

function unionTypeResolve(schema: Record<string, unknown>, path: string): string | null {
    for (const key of ["anyOf", "oneOf"] as const) {
        const variants = schema[key];
        if (!Array.isArray(variants) || variants.length === 0) {
            continue;
        }
        const unionTypes = variants.map((variant, index) => typeFromSchema(variant, `${path}.${key}[${index}]`));
        return unionTypeJoin(unionTypes, path);
    }

    if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
        throw new Error(`Unsupported Monty schema at ${path}.allOf: intersections are not supported.`);
    }

    return null;
}

function unionTypeJoin(candidates: string[], path: string): string {
    const unique = candidates.filter((candidate, index, all) => all.indexOf(candidate) === index);
    if (unique.length === 0) {
        throw new Error(`Unsupported Monty schema at ${path}: union resolved to no variants.`);
    }
    return unique.join(" | ");
}

function objectValueSchemaResolve(schema: Record<string, unknown>): unknown | null {
    const additionalProperties = schema.additionalProperties;
    if (recordIs(additionalProperties)) {
        return additionalProperties;
    }

    const patternProperties = schema.patternProperties;
    if (recordIs(patternProperties)) {
        const entries = Object.values(patternProperties);
        if (entries.length === 1) {
            return entries[0];
        }
    }

    return null;
}

function schemaAnyIs(schema: Record<string, unknown>): boolean {
    if (schema.type === "any") {
        return true;
    }

    const symbolSchema = schema as Record<PropertyKey, unknown>;
    return Object.getOwnPropertySymbols(schema).some((symbol) => {
        const value = symbolSchema[symbol];
        return value === "Any" || value === "Unknown";
    });
}

function recordIs(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
