import type { PGlite } from "@electric-sql/pglite";
import type { ExperimentsTodoDb } from "./experimentsTodoDb";

const DATABASE_URL = "idb://daycare-experiments-v1";
const PGLITE_CDN_BASE_URL = "https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.3.15/dist";

let databasePromise: Promise<PGlite> | null = null;
let fsBundlePromise: Promise<Blob> | null = null;
let wasmModulePromise: Promise<WebAssembly.Module> | null = null;

/**
 * Creates a persistent PGlite adapter for the experiments todos.
 * Expects: browser runtime with IndexedDB available.
 */
export function experimentsTodoDbCreate(): ExperimentsTodoDb {
    return {
        init: async () => {
            await databaseGet();
        },
        query: async <TRow extends Record<string, unknown>>(sql: string) => {
            const db = await databaseGet();
            const result = await db.query<TRow>(sql);
            return result.rows;
        },
        exec: async (sql) => {
            const db = await databaseGet();
            await db.exec(sql);
        }
    };
}

async function databaseGet(): Promise<PGlite> {
    if (!databasePromise) {
        databasePromise = (async () => {
            const PGliteCtor = pgliteResolveConstructor();
            const [fsBundle, wasmModule] = await Promise.all([pgliteFsBundleGet(), pgliteWasmModuleGet()]);
            const db = new PGliteCtor(DATABASE_URL, { fsBundle, wasmModule });
            await db.waitReady;
            return db;
        })();
    }
    return databasePromise;
}

function pgliteResolveConstructor(): PGliteConstructor {
    const moduleValue = require("@electric-sql/pglite") as {
        PGlite?: PGliteConstructor;
        default?: {
            PGlite?: PGliteConstructor;
        };
    };
    const ctor = moduleValue.PGlite ?? moduleValue.default?.PGlite;
    if (!ctor) {
        throw new Error("Failed to resolve PGlite constructor.");
    }
    return ctor;
}

type PGliteConstructor = new (dataDir?: string, options?: PGliteRuntimeOptions) => PGlite;

type PGliteRuntimeOptions = {
    fsBundle?: Blob | File;
    wasmModule?: WebAssembly.Module;
};

async function pgliteFsBundleGet(): Promise<Blob> {
    if (!fsBundlePromise) {
        fsBundlePromise = pgliteBlobFetch("pglite.data");
    }
    return fsBundlePromise;
}

async function pgliteWasmModuleGet(): Promise<WebAssembly.Module> {
    if (!wasmModulePromise) {
        wasmModulePromise = (async () => {
            const wasmBlob = await pgliteBlobFetch("pglite.wasm");
            const bytes = await wasmBlob.arrayBuffer();
            return WebAssembly.compile(bytes);
        })();
    }
    return wasmModulePromise;
}

async function pgliteBlobFetch(filename: "pglite.data" | "pglite.wasm"): Promise<Blob> {
    const url = `${PGLITE_CDN_BASE_URL}/${filename}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${filename} (${response.status}).`);
    }
    return response.blob();
}
