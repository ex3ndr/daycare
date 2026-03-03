import type { PGlite } from "@electric-sql/pglite";
import { createId } from "@paralleldrive/cuid2";
import type { ExperimentsTodoDb } from "./experimentsTodoDb";
import type { ExperimentsTodo } from "./experimentsTodoTypes";

const DATABASE_URL = "idb://daycare-experiments-v1";
const TABLE_NAME = "experiments_todos";

let databasePromise: Promise<PGlite> | null = null;

type TodoRow = {
    id: string;
    title: string;
    done: unknown;
    created_at: number | string;
};

/**
 * Creates a persistent PGlite adapter for the experiments todos.
 * Expects: browser runtime with IndexedDB available.
 */
export function experimentsTodoDbCreate(): ExperimentsTodoDb {
    return {
        init: async () => {
            const db = await databaseGet();
            await db.exec(`
                CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    done BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at BIGINT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_created_at ON ${TABLE_NAME} (created_at DESC);
            `);

            const countResult = await db.query<{ count: number | string }>(
                `SELECT COUNT(*)::int AS count FROM ${TABLE_NAME};`
            );
            const count = Number(countResult.rows[0]?.count ?? 0);
            if (count > 0) {
                return;
            }

            const now = Date.now();
            const seedTitles = [
                "Wire json-render state to PGlite rows",
                "Add automatic toggle and delete actions",
                "Persist todos across page reloads"
            ];

            for (const [index, title] of seedTitles.entries()) {
                await db.query(`INSERT INTO ${TABLE_NAME} (id, title, done, created_at) VALUES ($1, $2, $3, $4);`, [
                    createId(),
                    title,
                    false,
                    now - index
                ]);
            }
        },
        list: async () => {
            const db = await databaseGet();
            const result = await db.query<TodoRow>(
                `SELECT id, title, done, created_at FROM ${TABLE_NAME} ORDER BY created_at DESC;`
            );
            return result.rows.map((row) => todoFromRow(row));
        },
        create: async (title) => {
            const db = await databaseGet();
            await db.query(`INSERT INTO ${TABLE_NAME} (id, title, done, created_at) VALUES ($1, $2, $3, $4);`, [
                createId(),
                title,
                false,
                Date.now()
            ]);
        },
        toggle: async (id, done) => {
            const db = await databaseGet();
            await db.query(`UPDATE ${TABLE_NAME} SET done = $2 WHERE id = $1;`, [id, done]);
        },
        remove: async (id) => {
            const db = await databaseGet();
            await db.query(`DELETE FROM ${TABLE_NAME} WHERE id = $1;`, [id]);
        }
    };
}

async function databaseGet(): Promise<PGlite> {
    if (!databasePromise) {
        databasePromise = (async () => {
            const PGliteCtor = pgliteResolveConstructor();
            const db = new PGliteCtor(DATABASE_URL);
            await db.waitReady;
            return db;
        })();
    }
    return databasePromise;
}

function pgliteResolveConstructor(): new (dataDir?: string) => PGlite {
    const moduleValue = require("@electric-sql/pglite") as {
        PGlite?: new (dataDir?: string) => PGlite;
        default?: {
            PGlite?: new (dataDir?: string) => PGlite;
        };
    };
    const ctor = moduleValue.PGlite ?? moduleValue.default?.PGlite;
    if (!ctor) {
        throw new Error("Failed to resolve PGlite constructor.");
    }
    return ctor;
}

function todoFromRow(row: TodoRow): ExperimentsTodo {
    return {
        id: row.id,
        title: row.title,
        done: row.done === true || row.done === "t" || row.done === "true" || row.done === 1,
        createdAt: typeof row.created_at === "number" ? row.created_at : Number(row.created_at)
    };
}
