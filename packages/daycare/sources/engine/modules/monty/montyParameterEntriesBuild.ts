import type { Tool } from "@mariozechner/pi-ai";
import { montyPythonIdentifierIs } from "./montyPythonIdentifierIs.js";

type MontyParameterEntry = {
    name: string;
    schema: unknown;
    required: boolean;
};

/**
 * Builds ordered tool parameter entries for Monty Python binding.
 * Expects: tool.parameters follows JSON schema object shape when present.
 */
export function montyParameterEntriesBuild(tool: Tool): MontyParameterEntry[] {
    const parameters = parametersSchemaResolve(tool);
    const properties = propertiesSchemaResolve(parameters.properties);
    const required = new Set(requiredListResolve(parameters.required));

    const requiredEntries: MontyParameterEntry[] = [];
    const optionalEntries: MontyParameterEntry[] = [];

    for (const [name, schema] of Object.entries(properties)) {
        if (!montyPythonIdentifierIs(name)) {
            continue;
        }

        if (required.has(name)) {
            requiredEntries.push({ name, schema, required: true });
            continue;
        }

        optionalEntries.push({ name, schema, required: false });
    }

    return [...requiredEntries, ...optionalEntries];
}

function parametersSchemaResolve(tool: Tool): {
    properties?: Record<string, unknown>;
    required?: unknown;
} {
    const schema = tool.parameters as unknown;
    if (!recordIs(schema)) {
        return {};
    }

    return {
        properties: recordIs(schema.properties) ? schema.properties : undefined,
        required: schema.required
    };
}

function propertiesSchemaResolve(value: unknown): Record<string, unknown> {
    if (!recordIs(value)) {
        return {};
    }
    return value;
}

function requiredListResolve(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((entry): entry is string => typeof entry === "string");
}

function recordIs(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
