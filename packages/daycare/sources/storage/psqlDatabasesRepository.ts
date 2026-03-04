import { and, asc, eq } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { psqlDatabasesTable } from "../schema.js";
import type { PsqlDatabaseDbRecord } from "./databaseTypes.js";

export type PsqlDatabaseCreateInput = {
    id: string;
    name: string;
    createdAt: number;
};

/**
 * Stores metadata for per-user PGlite databases used by the psql service.
 * Expects: id and name are non-empty strings and ctx carries user scope.
 */
export class PsqlDatabasesRepository {
    private readonly db: DaycareDb;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async create(ctx: Context, input: PsqlDatabaseCreateInput): Promise<PsqlDatabaseDbRecord> {
        const id = input.id.trim();
        if (!id) {
            throw new Error("Database id is required.");
        }
        const name = input.name.trim();
        if (!name) {
            throw new Error("Database name is required.");
        }

        await this.db.insert(psqlDatabasesTable).values({
            userId: ctx.userId,
            id,
            name,
            createdAt: input.createdAt
        });

        return {
            userId: ctx.userId,
            id,
            name,
            createdAt: input.createdAt
        };
    }

    async findMany(ctx: Context): Promise<PsqlDatabaseDbRecord[]> {
        const rows = await this.db
            .select()
            .from(psqlDatabasesTable)
            .where(eq(psqlDatabasesTable.userId, ctx.userId))
            .orderBy(asc(psqlDatabasesTable.createdAt), asc(psqlDatabasesTable.id));

        return rows.map((row) => ({
            userId: row.userId,
            id: row.id,
            name: row.name,
            createdAt: row.createdAt
        }));
    }

    async findById(ctx: Context, id: string): Promise<PsqlDatabaseDbRecord | null> {
        const normalizedId = id.trim();
        if (!normalizedId) {
            return null;
        }

        const rows = await this.db
            .select()
            .from(psqlDatabasesTable)
            .where(and(eq(psqlDatabasesTable.userId, ctx.userId), eq(psqlDatabasesTable.id, normalizedId)))
            .limit(1);

        const row = rows[0];
        if (!row) {
            return null;
        }

        return {
            userId: row.userId,
            id: row.id,
            name: row.name,
            createdAt: row.createdAt
        };
    }
}
