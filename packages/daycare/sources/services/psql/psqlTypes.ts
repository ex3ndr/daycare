import type { PGlite } from "@electric-sql/pglite";

export type PsqlDatabase = {
    id: string;
    userId: string;
    name: string;
    createdAt: number;
};

export type PsqlColumnType = "text" | "integer" | "real" | "boolean" | "jsonb";

export type PsqlColumnDef = {
    name: string;
    type: PsqlColumnType;
    comment: string;
    nullable?: boolean;
};

export type PsqlTableSchema = {
    name: string;
    comment: string;
    columns: PsqlColumnDef[];
};

export type PsqlSchemaDeclaration = {
    tables: PsqlTableSchema[];
};

export type PsqlTableSchemaApply = {
    table: string;
    comment: string;
    fields: PsqlColumnDef[];
};

export type PsqlDataAddOp = {
    op: "add";
    table: string;
    data: Record<string, unknown>;
};

export type PsqlDataUpdateOp = {
    op: "update";
    table: string;
    id: string;
    data: Record<string, unknown>;
};

export type PsqlDataDeleteOp = {
    op: "delete";
    table: string;
    id: string;
};

export type PsqlDataOp = PsqlDataAddOp | PsqlDataUpdateOp | PsqlDataDeleteOp;

export const PSQL_COLUMN_TYPES: readonly PsqlColumnType[] = ["text", "integer", "real", "boolean", "jsonb"];

export const PSQL_SYSTEM_COLUMNS: readonly PsqlColumnDef[] = [
    { name: "id", type: "text", comment: "Stable row identity shared across versions." },
    { name: "version", type: "integer", comment: "Monotonic row version for this id." },
    { name: "valid_from", type: "integer", comment: "Unix timestamp (ms) when this version became valid." },
    {
        name: "valid_to",
        type: "integer",
        comment: "Unix timestamp (ms) when this version stopped being valid.",
        nullable: true
    },
    { name: "created_at", type: "integer", comment: "Unix timestamp (ms) when the row id was first created." },
    { name: "updated_at", type: "integer", comment: "Unix timestamp (ms) when this version was written." }
];

export type PsqlSchemaChange =
    | {
          kind: "table_add";
          table: PsqlTableSchema;
      }
    | {
          kind: "column_add";
          table: string;
          column: PsqlColumnDef;
      }
    | {
          kind: "table_comment_set";
          table: string;
          comment: string;
      }
    | {
          kind: "column_comment_set";
          table: string;
          column: string;
          comment: string;
      };

export type PsqlSchemaDiffResult = {
    changes: PsqlSchemaChange[];
    errors: string[];
};

export type PsqlSchemaApplyResult = {
    sql: string[];
};

export type PsqlSchemaResult = {
    changes: PsqlSchemaChange[];
    errors: string[];
};

export type PsqlRow = Record<string, unknown>;

export type PsqlClient = Pick<PGlite, "exec" | "query">;

/**
 * Validates whether a value is one of the supported JSON-declared column types.
 * Expects: value is unknown input from external JSON.
 */
export function psqlColumnTypeIs(value: unknown): value is PsqlColumnType {
    return typeof value === "string" && PSQL_COLUMN_TYPES.includes(value as PsqlColumnType);
}

/**
 * Validates whether unknown input is a psql data-operation payload.
 * Expects: input is a plain object with op-specific required fields.
 */
export function psqlDataOpIs(value: unknown): value is PsqlDataOp {
    if (!objectLikeIs(value)) {
        return false;
    }

    if (value.op === "add") {
        return typeof value.table === "string" && objectLikeIs(value.data) && !Array.isArray(value.data);
    }

    if (value.op === "update") {
        return (
            typeof value.table === "string" &&
            typeof value.id === "string" &&
            objectLikeIs(value.data) &&
            !Array.isArray(value.data)
        );
    }

    if (value.op === "delete") {
        return typeof value.table === "string" && typeof value.id === "string";
    }

    return false;
}

/**
 * Validates whether unknown input is a schema declaration payload.
 * Expects: declaration shape is { tables: [{ name, comment, columns: [{ name, type, comment, nullable? }] }] }.
 */
export function psqlSchemaDeclarationIs(value: unknown): value is PsqlSchemaDeclaration {
    if (!objectLikeIs(value) || !Array.isArray(value.tables)) {
        return false;
    }

    return value.tables.every((table) => {
        if (
            !objectLikeIs(table) ||
            typeof table.name !== "string" ||
            typeof table.comment !== "string" ||
            table.comment.trim().length === 0 ||
            !Array.isArray(table.columns)
        ) {
            return false;
        }
        return table.columns.every((column) => {
            if (
                !objectLikeIs(column) ||
                typeof column.name !== "string" ||
                typeof column.comment !== "string" ||
                column.comment.trim().length === 0 ||
                !psqlColumnTypeIs(column.type)
            ) {
                return false;
            }
            if (column.nullable !== undefined && typeof column.nullable !== "boolean") {
                return false;
            }
            return true;
        });
    });
}

/**
 * Validates whether unknown input is a single-table schema-apply payload.
 * Expects: shape is { table, comment, fields: [{ name, type, comment, nullable? }] }.
 */
export function psqlTableSchemaApplyIs(value: unknown): value is PsqlTableSchemaApply {
    if (
        !objectLikeIs(value) ||
        typeof value.table !== "string" ||
        value.table.trim().length === 0 ||
        typeof value.comment !== "string" ||
        value.comment.trim().length === 0 ||
        !Array.isArray(value.fields)
    ) {
        return false;
    }

    return value.fields.every((field) => {
        if (
            !objectLikeIs(field) ||
            typeof field.name !== "string" ||
            typeof field.comment !== "string" ||
            field.comment.trim().length === 0 ||
            !psqlColumnTypeIs(field.type)
        ) {
            return false;
        }
        if (field.nullable !== undefined && typeof field.nullable !== "boolean") {
            return false;
        }
        return true;
    });
}

function objectLikeIs(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
