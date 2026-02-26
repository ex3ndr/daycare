import type { Config } from "@/types";
import { Storage } from "./storage.js";
import { storageOpen } from "./storageOpen.js";

const sharedStorageByDbPath = new Map<string, Storage>();

/**
 * Resolves a Storage instance from either a Storage object or runtime Config.
 * Expects: config.dbPath is stable for process lifetime when using shared mode.
 */
export function storageResolve(input: Storage | Config): Storage {
    if (input instanceof Storage) {
        return input;
    }

    const cached = sharedStorageByDbPath.get(input.dbPath);
    if (cached) {
        return cached;
    }
    const storage = storageOpen(input.dbPath);
    sharedStorageByDbPath.set(input.dbPath, storage);
    return storage;
}
