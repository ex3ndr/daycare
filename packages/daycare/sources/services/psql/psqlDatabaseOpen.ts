import { promises as fs } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { Context } from "@/types";
import type { PsqlDatabasesRepository } from "../../storage/psqlDatabasesRepository.js";
import { AsyncLock } from "../../utils/lock.js";
import { psqlDatabasePathResolve } from "./psqlDatabasePathResolve.js";

export type PsqlDatabaseOpenInput = {
    ctx: Context;
    dbId: string;
    usersDir: string;
    databases: PsqlDatabasesRepository;
    cache: Map<string, PGlite>;
    openLocks: Map<string, AsyncLock>;
    databaseMode?: "file" | "memory";
};

/**
 * Opens or returns a cached per-user PGlite database instance.
 * Expects: dbId exists in metadata for the calling user.
 */
export async function psqlDatabaseOpen(input: PsqlDatabaseOpenInput): Promise<PGlite> {
    const dbId = input.dbId.trim();
    if (!dbId) {
        throw new Error("Database id is required.");
    }

    const cacheKey = `${input.ctx.userId}\u0000${dbId}`;
    const cached = input.cache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const lock = openLockFor(input.openLocks, cacheKey);
    return lock.inLock(async () => {
        const again = input.cache.get(cacheKey);
        if (again) {
            return again;
        }

        const metadata = await input.databases.findById(input.ctx, dbId);
        if (!metadata) {
            throw new Error(`Database not found: ${dbId}`);
        }

        const opened =
            input.databaseMode === "memory"
                ? new PGlite()
                : new PGlite(await databasePathEnsure(input.usersDir, input.ctx.userId, dbId));
        await opened.waitReady;
        input.cache.set(cacheKey, opened);
        return opened;
    });
}

async function databasePathEnsure(usersDir: string, userId: string, dbId: string): Promise<string> {
    const databasePath = psqlDatabasePathResolve(usersDir, userId, dbId);
    await fs.mkdir(databasePath, { recursive: true });
    return databasePath;
}

function openLockFor(openLocks: Map<string, AsyncLock>, key: string): AsyncLock {
    const existing = openLocks.get(key);
    if (existing) {
        return existing;
    }

    const created = new AsyncLock();
    openLocks.set(key, created);
    return created;
}
