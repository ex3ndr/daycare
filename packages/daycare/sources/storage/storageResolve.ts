import type { Config } from "@/types";
import { Storage } from "./storage.js";
import { storageOpen } from "./storageOpen.js";

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
    const storage = storageOpen(input.dbPath, {
        dbUrl: input.dbUrl,
        autoMigrate: input.dbAutoMigrate
    });
    sharedStorageByKey.set(key, storage);
    return storage;
}

function storageKeyResolve(config: Config): string {
    if (config.dbUrl) {
        return `postgres:${config.dbUrl}`;
    }
    return `pglite:${config.dbPath}`;
}
