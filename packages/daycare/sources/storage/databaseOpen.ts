import { mkdirSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { Client as PostgresClient } from "pg";

type StorageQueryResult<TRow> = {
    rows: TRow[];
    affectedRows?: number;
};

type StorageClient = {
    query: <TRow = Record<string, unknown>>(sqlText: string, params: unknown[]) => Promise<StorageQueryResult<TRow>>;
    exec: (sqlText: string) => Promise<void>;
    close: () => Promise<void>;
};

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

    private readonly client: StorageClient;
    private readonly queue: { tail: Promise<void> };
    private closePromise: Promise<void> | null = null;
    private closed = false;

    constructor(client: StorageClient, databasePath: string | null) {
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
        this.closePromise = this.queue.tail
            .then(() => this.client.close())
            .then(
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
export type StorageDatabaseTarget = { kind: "pglite"; path: StorageDatabasePath } | { kind: "postgres"; url: string };

/**
 * Opens a storage database client for either pglite or server postgres targets.
 * Expects: pglite path is ":memory:" or writable; postgres URL uses postgres:// or postgresql://.
 */
export function databaseOpen(target: StorageDatabasePath | StorageDatabaseTarget): StorageDatabase {
    if (typeof target !== "string" && target.kind === "postgres") {
        return new StorageDatabase(postgresClientBuild(target.url), null);
    }

    const dbPath = typeof target === "string" ? target : target.path;
    if (dbPath === ":memory:") {
        return new StorageDatabase(pgliteClientBuild(null), null);
    }

    const resolvedPath = databaseDataPathResolve(dbPath);
    mkdirSync(path.dirname(resolvedPath), { recursive: true });
    return new StorageDatabase(pgliteClientBuild(resolvedPath), resolvedPath);
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

function pgliteClientBuild(databasePath: string | null): StorageClient {
    const client = databasePath ? new PGlite(databasePath) : new PGlite();
    return {
        query: async <TRow = Record<string, unknown>>(sqlText: string, params: unknown[]) => {
            const result = await client.query<TRow>(sqlText, params);
            return {
                rows: result.rows,
                affectedRows: result.affectedRows
            };
        },
        exec: async (sqlText: string) => {
            await client.exec(sqlText);
        },
        close: async () => {
            await client.close();
        }
    };
}

function postgresClientBuild(url: string): StorageClient {
    const client = new PostgresClient({ connectionString: url });
    const connected = client.connect();
    // Avoid process-level unhandled rejection when open succeeds lazily after caller gives up.
    void connected.catch(() => undefined);

    return {
        query: async <TRow = Record<string, unknown>>(sqlText: string, params: unknown[]) => {
            await connected;
            const result = await client.query(sqlText, params);
            return {
                rows: result.rows as TRow[],
                affectedRows: result.rowCount ?? 0
            };
        },
        exec: async (sqlText: string) => {
            await connected;
            await client.query(sqlText);
        },
        close: async () => {
            await connected.catch(() => undefined);
            await client.end().catch(() => undefined);
        }
    };
}
