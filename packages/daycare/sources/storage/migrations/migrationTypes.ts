import type { DatabaseSync } from "node:sqlite";

export type Migration = {
  name: string;
  up: (db: DatabaseSync) => void;
};
