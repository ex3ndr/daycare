import type { Tool } from "@mariozechner/pi-ai";
import type { TSchema } from "@sinclair/typebox";

import { MONTY_RESPONSE_SCHEMA_KEY } from "./montyResponseSchemaKey.js";

/**
 * Resolves the hidden return schema attached to a tool for Monty typing/runtime conversion.
 * Expects: tools come from ToolResolver.listTools() or attach MONTY_RESPONSE_SCHEMA_KEY manually.
 */
export function montyResponseSchemaResolve(tool: Tool): TSchema | null {
    const metadata = tool as Tool & { [MONTY_RESPONSE_SCHEMA_KEY]?: unknown };
    const schema = metadata[MONTY_RESPONSE_SCHEMA_KEY];
    if (!schemaObjectIs(schema)) {
        return null;
    }
    return schema as TSchema;
}

function schemaObjectIs(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
