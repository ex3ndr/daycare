import type { PsqlClient, PsqlRow } from "./psqlTypes.js";

/**
 * Executes read-only SQL and enforces transaction-level read restrictions.
 * Expects: sql is a single read query and params are positional parameter values.
 */
export async function psqlQuery(db: PsqlClient, sqlText: string, params: unknown[] = []): Promise<PsqlRow[]> {
    const normalized = sqlText.trim();
    if (!normalized) {
        throw new Error("SQL is required.");
    }

    await db.exec("BEGIN READ ONLY");
    try {
        const result = await db.query<PsqlRow>(normalized, params);
        await db.exec("COMMIT");
        return result.rows;
    } catch (error) {
        await db.exec("ROLLBACK").catch(() => undefined);
        throw error;
    }
}
