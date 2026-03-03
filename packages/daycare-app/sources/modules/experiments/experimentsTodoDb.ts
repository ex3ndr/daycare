export type ExperimentsTodoDb = {
    init: () => Promise<void>;
    query: <TRow extends Record<string, unknown>>(sql: string) => Promise<TRow[]>;
    exec: (sql: string) => Promise<void>;
};

/**
 * Creates a todo database adapter.
 * Expects: web uses experimentsTodoDb.web.ts with PGlite; this fallback reports unsupported runtime.
 */
export function experimentsTodoDbCreate(): ExperimentsTodoDb {
    const unsupported = async () => {
        throw new Error("PGlite experiments are currently available on web runtime only.");
    };

    return {
        init: unsupported,
        query: unsupported,
        exec: unsupported
    };
}
