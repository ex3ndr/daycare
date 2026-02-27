import type { Config } from "@/types";
import { databaseMigrate } from "./databaseMigrate.js";
import { databaseOpen } from "./databaseOpen.js";
import { Storage } from "./storage.js";

const sharedStorageByKey = new Map<string, Storage>();

/**
 * Resolves a Storage instance from either a Storage object or runtime Config.
 * Expects: config database target is stable for process lifetime when using shared mode.
 */
export function storageResolve(input: Storage | Config): Storage {
    if (input instanceof Storage) {
        return input;
    }

    const key = storageKeyResolve(input);
    const cached = sharedStorageByKey.get(key);
    if (cached) {
        return cached;
    }
    const dbTarget = input.url ? { kind: "postgres" as const, url: input.url } : input.path;
    const db = databaseOpen(dbTarget);
    if (input.dbAutoMigrate) {
        void databaseMigrate(db);
    }
    const storage = Storage.fromDatabase(db);
    sharedStorageByKey.set(key, storage);
    return storage;
}

function storageKeyResolve(config: Config): string {
    if (config.url) {
        return `postgres:${config.url}`;
    }
    return `pglite:${config.path}`;
}
