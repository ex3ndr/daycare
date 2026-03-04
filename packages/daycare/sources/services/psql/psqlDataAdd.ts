import { createId } from "@paralleldrive/cuid2";
import { psqlIdentifierQuote } from "./psqlIdentifierQuote.js";
import { psqlTableDescribe } from "./psqlTableDescribe.js";
import type { PsqlClient, PsqlRow } from "./psqlTypes.js";

/**
 * Adds a new current row with system-versioning columns initialized.
 * Expects: table exists and data keys are business columns only.
 */
export async function psqlDataAdd(db: PsqlClient, table: string, data: Record<string, unknown>): Promise<PsqlRow> {
    const described = await psqlTableDescribe(db, table);
    const tableSql = psqlIdentifierQuote(table);

    for (const key of Object.keys(data)) {
        if (!described.businessByName.has(key)) {
            throw new Error(`Unknown column for table ${table}: ${key}`);
        }
    }

    const now = Date.now();
    const rowId = createId();

    const columns: string[] = ["id", "version", "valid_from", "valid_to", "created_at", "updated_at"];
    const values: unknown[] = [rowId, 1, now, null, now, now];

    for (const column of described.businessColumns) {
        const value = Object.hasOwn(data, column.name) ? data[column.name] : null;
        if (!column.nullable && (value === null || value === undefined)) {
            throw new Error(`Column ${table}.${column.name} is required.`);
        }
        columns.push(column.name);
        values.push(value ?? null);
    }

    const columnSql = columns.map((column) => psqlIdentifierQuote(column)).join(", ");
    const placeholderSql = values.map((_, index) => `$${index + 1}`).join(", ");
    const inserted = await db.query<PsqlRow>(
        `INSERT INTO ${tableSql} (${columnSql}) VALUES (${placeholderSql}) RETURNING *`,
        values
    );

    const row = inserted.rows[0];
    if (!row) {
        throw new Error(`Failed to insert row into ${table}.`);
    }
    return row;
}
