import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

const OMIT = Symbol("monty.omit");
const NO_MATCH = Symbol("monty.no-match");
const ALLOW_ANY = Symbol("monty.allow-any");
const unknownSchema = Type.Unknown();

/**
 * Converts a JS tool result into a Python-safe value that matches the given schema.
 * Expects: schema is a supported TypeBox/JSON-schema fragment for tool results/runtime helpers.
 */
export function montyValueToPython(value: unknown, schema: unknown, label: string): unknown {
    const converted = valueConvert(value, schema, label);
    if (converted === OMIT) {
        throw new Error(`${label} cannot be omitted.`);
    }
    if (!schemaMatches(schema, converted)) {
        throw new Error(`${label} does not match its declared schema after conversion.`);
    }
    return converted;
}

function valueConvert(value: unknown, schema: unknown, label: string): unknown {
    if (schemaAnyIs(schema)) {
        return genericValueConvert(value, label);
    }
    if (!recordIs(schema)) {
        throw new Error(`${label} uses an unsupported schema.`);
    }

    const union = unionConvert(value, schema, label);
    if (union !== NO_MATCH) {
        return union;
    }

    const type = schema.type;
    if (Array.isArray(type)) {
        return unionConvert(value, { anyOf: type.map((entry) => ({ type: entry })) }, label);
    }
    if (type === "string") {
        if (typeof value !== "string") {
            throw new Error(`${label} must be a string.`);
        }
        return value;
    }
    if (type === "integer") {
        if (typeof value !== "number" || !Number.isInteger(value)) {
            throw new Error(`${label} must be an integer.`);
        }
        return value;
    }
    if (type === "number") {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            throw new Error(`${label} must be a finite number.`);
        }
        return value;
    }
    if (type === "boolean") {
        if (typeof value !== "boolean") {
            throw new Error(`${label} must be a boolean.`);
        }
        return value;
    }
    if (type === "null") {
        if (value !== null) {
            throw new Error(`${label} must be null.`);
        }
        return null;
    }
    if (type === "array") {
        if (!Array.isArray(value)) {
            throw new Error(`${label} must be an array.`);
        }
        if (Array.isArray(schema.items)) {
            throw new Error(`${label} uses unsupported tuple array items.`);
        }
        return value.map((entry, index) => valueConvert(entry, schema.items, `${label}[${index}]`));
    }
    if (type === "object") {
        return objectConvert(value, schema, label);
    }

    throw new Error(`${label} uses an unsupported schema.`);
}

function objectConvert(value: unknown, schema: Record<string, unknown>, label: string): Record<string, unknown> {
    const record = recordFromValue(value, label);
    const properties = propertyRecordResolve(schema.properties);
    const additionalProperties = additionalPropertiesResolve(schema);
    const result: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(record)) {
        const propertySchema =
            properties[key] ?? (additionalProperties === ALLOW_ANY ? unknownSchema : additionalProperties);
        if (!propertySchema) {
            throw new Error(`${label}.${key} is not allowed by the schema.`);
        }
        const converted = propertyConvert(entry, propertySchema, `${label}.${key}`);
        if (converted === OMIT) {
            continue;
        }
        result[key] = converted;
    }

    return result;
}

function propertyConvert(value: unknown, schema: unknown, label: string): unknown {
    if (value === undefined) {
        return propertyOptionalOmitIs(schema) ? OMIT : null;
    }
    return valueConvert(value, schema, label);
}

function unionConvert(value: unknown, schema: Record<string, unknown>, label: string): unknown {
    for (const key of ["anyOf", "oneOf"] as const) {
        const variants = schema[key];
        if (!Array.isArray(variants) || variants.length === 0) {
            continue;
        }
        const errors: string[] = [];
        for (const [index, variant] of variants.entries()) {
            try {
                return valueConvert(value, variant, `${label} (${key}[${index}])`);
            } catch (error) {
                errors.push(error instanceof Error ? error.message : String(error));
            }
        }
        throw new Error(errors[0] ?? `${label} does not match any union variant.`);
    }
    if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
        throw new Error(`${label} uses unsupported intersection schema.`);
    }
    return NO_MATCH;
}

function genericValueConvert(value: unknown, label: string): unknown {
    if (value === undefined) {
        return null;
    }
    if (value === null || typeof value === "string" || typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            throw new Error(`${label} must be a finite number.`);
        }
        return value;
    }
    if (typeof value === "bigint") {
        return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)
            ? Number(value)
            : value.toString();
    }
    if (Array.isArray(value)) {
        return value.map((entry, index) => genericValueConvert(entry, `${label}[${index}]`));
    }
    if (value instanceof Date || Buffer.isBuffer(value) || value instanceof Set || value instanceof RegExp) {
        throw new Error(`${label} cannot be converted from ${valueTypeResolve(value)}.`);
    }
    if (value instanceof Map) {
        return objectConvert(Object.fromEntries(value.entries()), {}, label);
    }
    if (!recordIs(value)) {
        throw new Error(`${label} cannot be converted from ${valueTypeResolve(value)}.`);
    }

    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
        const converted = genericValueConvert(entry, `${label}.${key}`);
        if (converted === OMIT) {
            continue;
        }
        result[key] = converted;
    }
    return result;
}

function propertyOptionalOmitIs(schema: unknown): boolean {
    if (!recordIs(schema)) {
        return false;
    }
    if (schemaAnyIs(schema)) {
        return false;
    }
    if (schema.type === "null") {
        return false;
    }
    if (Array.isArray(schema.type) && schema.type.includes("null")) {
        return false;
    }
    for (const key of ["anyOf", "oneOf"] as const) {
        const variants = schema[key];
        if (!Array.isArray(variants)) {
            continue;
        }
        if (variants.some((variant) => schemaNullableIs(variant))) {
            return false;
        }
    }
    return true;
}

function schemaNullableIs(schema: unknown): boolean {
    if (!recordIs(schema)) {
        return false;
    }
    if (schemaAnyIs(schema)) {
        return true;
    }
    if (schema.type === "null") {
        return true;
    }
    if (Array.isArray(schema.type) && schema.type.includes("null")) {
        return true;
    }
    return false;
}

function schemaMatches(schema: unknown, value: unknown): boolean {
    if (!recordIs(schema)) {
        return false;
    }
    try {
        return Value.Check(schema as never, value);
    } catch {
        return true;
    }
}

function recordFromValue(value: unknown, label: string): Record<string, unknown> {
    if (value instanceof Map) {
        return Object.fromEntries(value.entries());
    }
    if (!recordIs(value)) {
        throw new Error(`${label} must be an object.`);
    }
    return value;
}

function additionalPropertiesResolve(schema: Record<string, unknown>): unknown | typeof ALLOW_ANY | null {
    const additionalProperties = schema.additionalProperties;
    if (recordIs(additionalProperties)) {
        return additionalProperties;
    }
    if (additionalProperties === true || additionalProperties === undefined) {
        return ALLOW_ANY;
    }
    const patternProperties = propertyRecordResolve(schema.patternProperties);
    const entries = Object.values(patternProperties);
    if (entries.length === 1) {
        return entries[0];
    }
    return null;
}

function propertyRecordResolve(value: unknown): Record<string, unknown> {
    if (!recordIs(value)) {
        return {};
    }
    return value;
}

function schemaAnyIs(schema: unknown): boolean {
    if (!recordIs(schema)) {
        return false;
    }
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

function valueTypeResolve(value: unknown): string {
    if (value === null) {
        return "null";
    }
    if (value === undefined) {
        return "undefined";
    }
    if (value instanceof Date) {
        return "Date";
    }
    if (Buffer.isBuffer(value)) {
        return "Buffer";
    }
    if (value instanceof Set) {
        return "Set";
    }
    return typeof value;
}
