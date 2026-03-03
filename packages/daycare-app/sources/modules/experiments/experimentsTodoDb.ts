import type { ExperimentsTodo } from "./experimentsTodoTypes";

export type ExperimentsTodoDb = {
    init: () => Promise<void>;
    list: () => Promise<ExperimentsTodo[]>;
    create: (title: string) => Promise<void>;
    toggle: (id: string, done: boolean) => Promise<void>;
    remove: (id: string) => Promise<void>;
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
        list: unsupported,
        create: unsupported,
        toggle: unsupported,
        remove: unsupported
    };
}
