import { promises as fs } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { createId } from "@paralleldrive/cuid2";
import type { Context } from "@/types";
import type { PsqlDatabasesRepository } from "../../storage/psqlDatabasesRepository.js";
import { psqlDatabasePathResolve } from "./psqlDatabasePathResolve.js";
import type { PsqlDatabase } from "./psqlTypes.js";

export type PsqlDatabaseCreateInput = {
    ctx: Context;
    usersDir: string;
    databases: PsqlDatabasesRepository;
    name: string;
    databaseMode?: "file" | "memory";
};

/**
 * Creates a new user-scoped PGlite database directory and metadata record.
 * Expects: name is a non-empty display name.
 */
export async function psqlDatabaseCreate(input: PsqlDatabaseCreateInput): Promise<PsqlDatabase> {
    const name = input.name.trim();
    if (!name) {
        throw new Error("Database name is required.");
    }

    const createdAt = Date.now();
    const id = createId();
    if (input.databaseMode !== "memory") {
        const databasePath = psqlDatabasePathResolve(input.usersDir, input.ctx.userId, id);
        await fs.mkdir(databasePath, { recursive: true });
        const database = new PGlite(databasePath);
        await database.waitReady;
        await database.close();
    }

    const record = await input.databases.create(input.ctx, {
        id,
        name,
        createdAt
    });

    return {
        id: record.id,
        userId: record.userId,
        name: record.name,
        createdAt: record.createdAt
    };
}
