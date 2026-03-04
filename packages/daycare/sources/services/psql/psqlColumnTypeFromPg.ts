import type { PsqlColumnType } from "./psqlTypes.js";

/**
 * Maps PostgreSQL information_schema data_type values into declaration column types.
 * Expects: dataType comes from information_schema.columns.data_type.
 */
export function psqlColumnTypeFromPg(dataType: string): PsqlColumnType {
    if (dataType === "text") {
        return "text";
    }
    if (dataType === "integer") {
        return "integer";
    }
    if (dataType === "real") {
        return "real";
    }
    if (dataType === "boolean") {
        return "boolean";
    }
    if (dataType === "jsonb") {
        return "jsonb";
    }

    throw new Error(`Unsupported column type in database: ${dataType}`);
}
