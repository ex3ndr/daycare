import type { Context } from "@/types";
import type { PsqlDatabasesRepository } from "../../storage/psqlDatabasesRepository.js";
import { AsyncLock } from "../../utils/lock.js";
import { psqlDataAdd } from "./psqlDataAdd.js";
import { psqlDatabaseCreate } from "./psqlDatabaseCreate.js";
import { psqlDatabaseList } from "./psqlDatabaseList.js";
import { psqlDatabaseOpen } from "./psqlDatabaseOpen.js";
import { psqlDataDelete } from "./psqlDataDelete.js";
import { psqlDataUpdate } from "./psqlDataUpdate.js";
import { psqlQuery } from "./psqlQuery.js";
import { psqlSchemaApply } from "./psqlSchemaApply.js";
import { psqlSchemaDiff } from "./psqlSchemaDiff.js";
import { psqlSchemaIntrospect } from "./psqlSchemaIntrospect.js";
import type {
    PsqlDatabase,
    PsqlRow,
    PsqlSchemaDeclaration,
    PsqlSchemaResult,
    PsqlTableSchemaApply
} from "./psqlTypes.js";

export type PsqlServiceOptions = {
    usersDir: string;
    databases: PsqlDatabasesRepository;
    databaseMode?: "file" | "memory";
};

/**
 * Facade for all psql database lifecycle, schema, data, and query operations.
 * Expects: metadata repository is backed by migrated storage.
 */
export class PsqlService {
    private readonly usersDir: string;
    private readonly databases: PsqlDatabasesRepository;
    private readonly databaseMode: "file" | "memory";
    private readonly cache = new Map<string, import("@electric-sql/pglite").PGlite>();
    private readonly openLocks = new Map<string, AsyncLock>();
    private readonly writeLocks = new Map<string, AsyncLock>();

    constructor(options: PsqlServiceOptions) {
        this.usersDir = options.usersDir;
        this.databases = options.databases;
        this.databaseMode = options.databaseMode ?? "file";
    }

    async createDatabase(ctx: Context, name: string): Promise<PsqlDatabase> {
        return psqlDatabaseCreate({
            ctx,
            usersDir: this.usersDir,
            databases: this.databases,
            name,
            databaseMode: this.databaseMode
        });
    }

    async listDatabases(ctx: Context): Promise<PsqlDatabase[]> {
        return psqlDatabaseList(ctx, this.databases);
    }

    async applySchema(ctx: Context, dbId: string, declaration: PsqlTableSchemaApply): Promise<PsqlSchemaResult> {
        const db = await this.databaseOpen(ctx, dbId);
        return this.writeLockFor(ctx.userId, dbId).inLock(async () => {
            const current = await psqlSchemaIntrospect(db);
            const currentTable = current.tables.find((table) => table.name === declaration.table);
            const diff = psqlSchemaDiff(
                {
                    name: declaration.table,
                    comment: declaration.comment,
                    columns: declaration.fields
                },
                currentTable ?? null
            );
            if (diff.errors.length > 0) {
                return {
                    changes: diff.changes,
                    errors: diff.errors
                };
            }

            await psqlSchemaApply(db, diff);
            return {
                changes: diff.changes,
                errors: []
            };
        });
    }

    async getSchema(ctx: Context, dbId: string): Promise<PsqlSchemaDeclaration> {
        const db = await this.databaseOpen(ctx, dbId);
        return psqlSchemaIntrospect(db);
    }

    async add(ctx: Context, dbId: string, table: string, data: Record<string, unknown>): Promise<PsqlRow> {
        const db = await this.databaseOpen(ctx, dbId);
        return this.writeLockFor(ctx.userId, dbId).inLock(async () => psqlDataAdd(db, table, data));
    }

    async update(
        ctx: Context,
        dbId: string,
        table: string,
        id: string,
        data: Record<string, unknown>
    ): Promise<PsqlRow> {
        const db = await this.databaseOpen(ctx, dbId);
        return this.writeLockFor(ctx.userId, dbId).inLock(async () => psqlDataUpdate(db, table, id, data));
    }

    async delete(ctx: Context, dbId: string, table: string, id: string): Promise<PsqlRow> {
        const db = await this.databaseOpen(ctx, dbId);
        return this.writeLockFor(ctx.userId, dbId).inLock(async () => psqlDataDelete(db, table, id));
    }

    async query(ctx: Context, dbId: string, sqlText: string, params: unknown[] = []): Promise<PsqlRow[]> {
        const db = await this.databaseOpen(ctx, dbId);
        return this.writeLockFor(ctx.userId, dbId).inLock(async () => psqlQuery(db, sqlText, params));
    }

    async systemPromptSection(ctx: Context): Promise<string> {
        const databases = await this.listDatabases(ctx);
        if (databases.length === 0) {
            return "## PSQL Databases\nNo user databases available.";
        }

        const lines: string[] = ["## PSQL Databases"];
        for (const entry of databases) {
            lines.push(`- ${entry.name} (${entry.id})`);
            try {
                const schema = await this.getSchema(ctx, entry.id);
                if (schema.tables.length === 0) {
                    lines.push("  tables: (none)");
                    continue;
                }
                const tableDescriptions = schema.tables.map((table) => {
                    const columns = table.columns
                        .map((column) => `${column.name}:${column.type}${column.nullable ? "?" : ""}`)
                        .join(", ");
                    return `${table.name}[${columns}]`;
                });
                lines.push(`  tables: ${tableDescriptions.join("; ")}`);
            } catch (error) {
                const message = error instanceof Error ? error.message : "failed to inspect schema";
                lines.push(`  tables: (error: ${message})`);
            }
        }

        return lines.join("\n");
    }

    private async databaseOpen(ctx: Context, dbId: string) {
        return psqlDatabaseOpen({
            ctx,
            dbId,
            usersDir: this.usersDir,
            databases: this.databases,
            cache: this.cache,
            openLocks: this.openLocks,
            databaseMode: this.databaseMode
        });
    }

    private writeLockFor(userId: string, dbId: string): AsyncLock {
        const key = `${userId}\u0000${dbId.trim()}`;
        const existing = this.writeLocks.get(key);
        if (existing) {
            return existing;
        }

        const created = new AsyncLock();
        this.writeLocks.set(key, created);
        return created;
    }
}
