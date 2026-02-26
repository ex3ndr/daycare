import { mkdirSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";

export type StorageStatementRunResult = {
    changes?: number;
    lastInsertRowid?: number | bigint;
};

export type StorageStatement = {
    run: (...params: unknown[]) => Promise<StorageStatementRunResult>;
    get: <TRow = Record<string, unknown>>(...params: unknown[]) => Promise<TRow | undefined>;
    all: <TRow = Record<string, unknown>>(...params: unknown[]) => Promise<TRow[]>;
};

export class StorageDatabase {
    readonly __daycareDatabasePath: string | null;

    private readonly client: PGlite;
    private readonly queue: { tail: Promise<void> };
    private closePromise: Promise<void> | null = null;
    private closed = false;

    constructor(client: PGlite, databasePath: string | null) {
        this.client = client;
        this.__daycareDatabasePath = databasePath;
        this.queue = { tail: Promise.resolve() };
    }

    prepare(sqlText: string): StorageStatement {
        const transformed = sqlParametersTransform(sqlText);
        return {
            run: async (...params) => {
                const result = await this.query(transformed, params);
                return {
                    changes: result.affectedRows ?? 0,
                    lastInsertRowid: undefined
                };
            },
            get: async <TRow = Record<string, unknown>>(...params: unknown[]) => {
                const result = await this.query<TRow>(transformed, params);
                return result.rows[0];
            },
            all: async <TRow = Record<string, unknown>>(...params: unknown[]) => {
                const result = await this.query<TRow>(transformed, params);
                return result.rows;
            }
        };
    }

    async exec(sqlText: string): Promise<void> {
        await this.enqueue(async () => {
            await this.client.exec(sqlText);
        });
    }

    close(): Promise<void> {
        if (this.closePromise) {
            return this.closePromise;
        }

        this.closed = true;
        this.closePromise = this.queue.tail.then(() => this.client.close()).then(
            () => undefined,
            () => undefined
        );
        return this.closePromise;
    }

    private async query<TRow = Record<string, unknown>>(
        sqlText: string,
        params: unknown[]
    ): Promise<{ rows: TRow[]; affectedRows?: number }> {
        return this.enqueue(async () => {
            const result = await this.client.query<TRow>(sqlText, params);
            return {
                rows: result.rows,
                affectedRows: result.affectedRows
            };
        });
    }

    private async enqueue<T>(task: () => Promise<T>): Promise<T> {
        if (this.closed) {
            throw new Error("Database is closed");
        }

        const run = this.queue.tail.then(task);

        this.queue.tail = run.then(
            () => undefined,
            () => undefined
        );

        return run;
    }
}

export type StorageDatabasePath = string;

/**
 * Opens a storage database client and initializes either in-memory or file-backed PGlite.
 * Expects: dbPath is ":memory:" or an absolute writable runtime path.
 */
export function databaseOpen(dbPath: StorageDatabasePath): StorageDatabase {
    if (dbPath === ":memory:") {
        return new StorageDatabase(new PGlite(), null);
    }

    const resolvedPath = databaseDataPathResolve(dbPath);
    mkdirSync(path.dirname(resolvedPath), { recursive: true });
    return new StorageDatabase(new PGlite(resolvedPath), resolvedPath);
}

function databaseDataPathResolve(dbPath: string): string {
    if (dbPath.endsWith(".pglite")) {
        return dbPath;
    }

    const base = path.basename(dbPath, path.extname(dbPath));
    return path.join(path.dirname(dbPath), `${base}.pglite`);
}

function sqlParametersTransform(sqlText: string): string {
    let transformed = "";
    let index = 1;
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < sqlText.length; i += 1) {
        const current = sqlText[i];
        const next = sqlText[i + 1];

        if (current === "'" && !inDouble) {
            transformed += current;
            if (inSingle && next === "'") {
                transformed += next;
                i += 1;
                continue;
            }
            inSingle = !inSingle;
            continue;
        }

        if (current === '"' && !inSingle) {
            transformed += current;
            if (inDouble && next === '"') {
                transformed += next;
                i += 1;
                continue;
            }
            inDouble = !inDouble;
            continue;
        }

        if (current === "?" && !inSingle && !inDouble) {
            transformed += `$${index}`;
            index += 1;
            continue;
        }

        transformed += current;
    }

    return transformed;
}
