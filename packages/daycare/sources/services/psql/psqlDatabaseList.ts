import type { Context } from "@/types";
import type { PsqlDatabasesRepository } from "../../storage/psqlDatabasesRepository.js";
import type { PsqlDatabase } from "./psqlTypes.js";

/**
 * Lists user-scoped psql databases from metadata storage.
 * Expects: ctx carries authenticated user scope.
 */
export async function psqlDatabaseList(ctx: Context, databases: PsqlDatabasesRepository): Promise<PsqlDatabase[]> {
    const rows = await databases.findMany(ctx);
    return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        name: row.name,
        createdAt: row.createdAt
    }));
}
