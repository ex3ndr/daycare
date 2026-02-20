import { montyPythonIdentifierIs } from "./montyPythonIdentifierIs.js";
import { montyPythonTypeFromSchema } from "./montyPythonTypeFromSchema.js";
import { montyResponseTypeNameFromFunction } from "./montyResponseTypeNameFromFunction.js";

type TypedDictField = {
    name: string;
    typeHint: string;
};

/**
 * Builds TypedDict class lines for a function response schema.
 * Expects: responseTypeName is a valid Python class identifier.
 */
export function montyResponseTypedDictLinesBuild(responseTypeName: string, responseSchema: unknown): string[] {
    const definitions: Array<{ name: string; fields: TypedDictField[] }> = [];
    const rootFields = typedDictFieldsBuild(responseTypeName, responseSchema, definitions);
    definitions.push({ name: responseTypeName, fields: rootFields });

    const lines: string[] = [];
    for (const [index, definition] of definitions.entries()) {
        if (index > 0) {
            lines.push("");
        }
        const fieldsExpression = typedDictFieldsExpressionBuild(definition.fields);
        lines.push(`${definition.name} = TypedDict("${definition.name}", ${fieldsExpression})`);
    }
    return lines;
}

function typedDictFieldsExpressionBuild(fields: TypedDictField[]): string {
    if (fields.length === 0) {
        return "{}";
    }
    const entries = fields.map((field) => {
        return `"${field.name}": ${field.typeHint}`;
    });
    return `{ ${entries.join(", ")} }`;
}

function typedDictFieldsBuild(
    responseTypeName: string,
    schema: unknown,
    definitions: Array<{ name: string; fields: TypedDictField[] }>
): TypedDictField[] {
    if (!recordIs(schema)) {
        return [];
    }
    const properties = propertyRecordResolve(schema.properties);
    const fields: TypedDictField[] = [];

    for (const [name, propertySchema] of Object.entries(properties)) {
        if (!montyPythonIdentifierIs(name)) {
            continue;
        }
        const rowItemSchema = arrayObjectItemSchemaResolve(propertySchema);
        if (rowItemSchema) {
            const rowTypeName = `${responseTypeName}${montyResponseTypeNameFromFunction(name).replace(/Response$/, "")}Item`;
            const rowFields = typedDictFieldsBuild(rowTypeName, rowItemSchema, definitions);
            definitions.push({ name: rowTypeName, fields: rowFields });
            fields.push({
                name,
                typeHint: `list[${rowTypeName}]`
            });
            continue;
        }

        fields.push({
            name,
            typeHint: montyPythonTypeFromSchema(propertySchema)
        });
    }
    return fields;
}

function arrayObjectItemSchemaResolve(schema: unknown): Record<string, unknown> | null {
    if (!recordIs(schema) || schema.type !== "array") {
        return null;
    }
    if (!recordIs(schema.items) || schema.items.type !== "object") {
        return null;
    }
    return schema.items;
}

function propertyRecordResolve(value: unknown): Record<string, unknown> {
    if (!recordIs(value)) {
        return {};
    }
    return value;
}

function recordIs(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
