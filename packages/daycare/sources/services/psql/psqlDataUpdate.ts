import { psqlIdentifierQuote } from "./psqlIdentifierQuote.js";
import { psqlTableDescribe } from "./psqlTableDescribe.js";
import type { PsqlClient, PsqlRow } from "./psqlTypes.js";

/**
 * Versions an existing current row by closing it and inserting version+1.
 * Expects: row exists with a current version.
 */
export async function psqlDataUpdate(
    db: PsqlClient,
    table: string,
    id: string,
    data: Record<string, unknown>
): Promise<PsqlRow> {
    const tableSql = psqlIdentifierQuote(table);
    const described = await psqlTableDescribe(db, table);

    for (const key of Object.keys(data)) {
        if (!described.businessByName.has(key)) {
            throw new Error(`Unknown column for table ${table}: ${key}`);
        }
    }

    await db.exec("BEGIN");
    try {
        const currentResult = await db.query<PsqlRow>(
            `SELECT * FROM ${tableSql} WHERE "id" = $1 AND "valid_to" IS NULL ORDER BY "version" DESC LIMIT 1`,
            [id]
        );
        const current = currentResult.rows[0];
        if (!current) {
            if (await rowHistoryExists(db, tableSql, id)) {
                throw new Error(`Row is already deleted: ${table}.${id}`);
            }
            throw new Error(`Row not found for update: ${table}.${id}`);
        }

        const now = Date.now();
        const previousVersion = numberFromRow(current, "version");
        const createdAt = numberFromRow(current, "created_at");
        const columns: string[] = ["id", "version", "valid_from", "valid_to", "created_at", "updated_at"];
        const values: unknown[] = [id, previousVersion + 1, now, null, createdAt, now];

        for (const column of described.businessColumns) {
            const nextValue = Object.hasOwn(data, column.name) ? data[column.name] : current[column.name];
            if (!column.nullable && (nextValue === null || nextValue === undefined)) {
                throw new Error(`Column ${table}.${column.name} is required.`);
            }
            columns.push(column.name);
            values.push(nextValue ?? null);
        }

        await db.query(
            `UPDATE ${tableSql} SET "valid_to" = $1 WHERE "id" = $2 AND "version" = $3 AND "valid_to" IS NULL`,
            [now, id, previousVersion]
        );

        const inserted = await db.query<PsqlRow>(
            `INSERT INTO ${tableSql} (${columns.map((column) => psqlIdentifierQuote(column)).join(", ")}) VALUES (${values
                .map((_, index) => `$${index + 1}`)
                .join(", ")}) RETURNING *`,
            values
        );

        const row = inserted.rows[0];
        if (!row) {
            throw new Error(`Failed to update row ${table}.${id}.`);
        }
        await db.exec("COMMIT");
        return row;
    } catch (error) {
        await db.exec("ROLLBACK").catch(() => undefined);
        throw error;
    }
}

function numberFromRow(row: PsqlRow, field: string): number {
    const value = row[field];
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`Expected numeric field on row: ${field}`);
    }
    return value;
}

async function rowHistoryExists(db: PsqlClient, tableSql: string, id: string): Promise<boolean> {
    const existingResult = await db.query<PsqlRow>(`SELECT "id" FROM ${tableSql} WHERE "id" = $1 LIMIT 1`, [id]);
    return existingResult.rows.length > 0;
}
