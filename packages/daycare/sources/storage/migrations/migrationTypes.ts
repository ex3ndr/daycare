import type { StorageDatabase } from "../databaseOpen.js";

export type Migration = {
    name: string;
    up: (db: StorageDatabase) => void;
};
