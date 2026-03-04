import { psqlIdentifierQuote } from "./psqlIdentifierQuote.js";
import type { PsqlClient, PsqlRow } from "./psqlTypes.js";

/**
 * Deletes a row by closing the current version (no replacement current version is inserted).
 * Expects: row exists with a current version.
 */
export async function psqlDataDelete(db: PsqlClient, table: string, id: string): Promise<PsqlRow> {
    const tableSql = psqlIdentifierQuote(table);

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
            throw new Error(`Row not found for delete: ${table}.${id}`);
        }

        const now = Date.now();
        const previousVersion = numberFromRow(current, "version");
        const closed = await db.query<PsqlRow>(
            `UPDATE ${tableSql} SET "valid_to" = $1 WHERE "id" = $2 AND "version" = $3 AND "valid_to" IS NULL RETURNING *`,
            [now, id, previousVersion]
        );
        const row = closed.rows[0];
        if (!row) {
            throw new Error(`Failed to delete row ${table}.${id}.`);
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
