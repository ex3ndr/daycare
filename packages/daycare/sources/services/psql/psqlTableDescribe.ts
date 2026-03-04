import { psqlColumnTypeFromPg } from "./psqlColumnTypeFromPg.js";
import { psqlSystemColumnNameIs } from "./psqlSchemaApply.js";
import type { PsqlClient, PsqlColumnType } from "./psqlTypes.js";

type ColumnInfoRow = {
    column_name: string;
    data_type: string;
    is_nullable: "YES" | "NO";
    ordinal_position: number;
};

export type PsqlTableBusinessColumn = {
    name: string;
    type: PsqlColumnType;
    nullable: boolean;
};

export type PsqlTableDescription = {
    table: string;
    businessColumns: PsqlTableBusinessColumn[];
    businessByName: Map<string, PsqlTableBusinessColumn>;
};

/**
 * Loads runtime table shape from information_schema and separates business columns from system columns.
 * Expects: table exists in public schema.
 */
export async function psqlTableDescribe(db: PsqlClient, table: string): Promise<PsqlTableDescription> {
    const rows = await db.query<ColumnInfoRow>(
        `
        SELECT column_name, data_type, is_nullable, ordinal_position
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position ASC
        `,
        [table]
    );

    if (rows.rows.length === 0) {
        throw new Error(`Table not found: ${table}`);
    }

    const businessColumns = rows.rows
        .filter((row) => !psqlSystemColumnNameIs(row.column_name))
        .map((row) => ({
            name: row.column_name,
            type: psqlColumnTypeFromPg(row.data_type),
            nullable: row.is_nullable === "YES"
        }));

    return {
        table,
        businessColumns,
        businessByName: new Map(businessColumns.map((column) => [column.name, column]))
    };
}
