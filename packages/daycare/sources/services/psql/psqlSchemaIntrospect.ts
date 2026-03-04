import { psqlColumnTypeFromPg } from "./psqlColumnTypeFromPg.js";
import { PSQL_SYSTEM_COLUMNS, type PsqlClient, type PsqlSchemaDeclaration } from "./psqlTypes.js";

type PsqlColumnRow = {
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: "YES" | "NO";
    ordinal_position: number;
    column_comment: string | null;
};

type PsqlTableRow = {
    table_name: string;
    table_comment: string | null;
};

/**
 * Reads current schema state from a PGlite database and emits declaration JSON.
 * Expects: db is an open PostgreSQL-compatible client.
 */
export async function psqlSchemaIntrospect(db: PsqlClient): Promise<PsqlSchemaDeclaration> {
    const tables = await db.query<PsqlTableRow>(
        `
        SELECT tables.table_name, obj_description(classes.oid, 'pg_class') AS table_comment
        FROM information_schema.tables AS tables
        JOIN pg_catalog.pg_class AS classes ON classes.relname = tables.table_name
        JOIN pg_catalog.pg_namespace AS namespaces ON namespaces.oid = classes.relnamespace
        WHERE tables.table_schema = 'public'
          AND tables.table_type = 'BASE TABLE'
          AND namespaces.nspname = tables.table_schema
        ORDER BY tables.table_name ASC
        `
    );
    const rows = await db.query<PsqlColumnRow>(
        `
        SELECT
            columns.table_name,
            columns.column_name,
            columns.data_type,
            columns.is_nullable,
            columns.ordinal_position,
            col_description(classes.oid, attributes.attnum) AS column_comment
        FROM information_schema.columns AS columns
        JOIN pg_catalog.pg_class AS classes ON classes.relname = columns.table_name
        JOIN pg_catalog.pg_namespace AS namespaces ON namespaces.oid = classes.relnamespace
        JOIN pg_catalog.pg_attribute AS attributes ON attributes.attrelid = classes.oid
        WHERE columns.table_schema = 'public'
          AND namespaces.nspname = columns.table_schema
          AND attributes.attname = columns.column_name
          AND attributes.attnum > 0
          AND NOT attributes.attisdropped
        ORDER BY columns.table_name ASC, columns.ordinal_position ASC
        `
    );

    const systemColumnNames = new Set(PSQL_SYSTEM_COLUMNS.map((column) => column.name));
    const byTable = new Map<string, PsqlSchemaDeclaration["tables"][number]>();
    for (const table of tables.rows) {
        byTable.set(table.table_name, {
            name: table.table_name,
            comment: table.table_comment?.trim() ?? "",
            columns: []
        });
    }

    for (const row of rows.rows) {
        if (systemColumnNames.has(row.column_name)) {
            continue;
        }

        const table = byTable.get(row.table_name);
        if (!table) {
            continue;
        }

        table.columns.push({
            name: row.column_name,
            type: psqlColumnTypeFromPg(row.data_type),
            comment: row.column_comment?.trim() ?? "",
            nullable: row.is_nullable === "YES"
        });
    }

    return {
        tables: [...byTable.values()].sort((a, b) => a.name.localeCompare(b.name))
    };
}
