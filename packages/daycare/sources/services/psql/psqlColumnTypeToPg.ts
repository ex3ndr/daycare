import type { PsqlColumnType } from "./psqlTypes.js";

/**
 * Maps declaration column types to PostgreSQL SQL type names.
 * Expects: input type is one of the supported psql declaration types.
 */
export function psqlColumnTypeToPg(type: PsqlColumnType): string {
    if (type === "text") {
        return "text";
    }
    if (type === "integer") {
        return "integer";
    }
    if (type === "real") {
        return "real";
    }
    if (type === "boolean") {
        return "boolean";
    }
    if (type === "jsonb") {
        return "jsonb";
    }
    throw new Error(`Unsupported declaration column type: ${type satisfies never}`);
}
