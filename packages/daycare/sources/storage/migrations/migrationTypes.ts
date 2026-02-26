import type { StorageDatabase as DatabaseSync } from "../databaseOpen.js";

export type Migration = {
    name: string;
    up: (db: DatabaseSync) => void;
    inTransaction?: boolean;
};
