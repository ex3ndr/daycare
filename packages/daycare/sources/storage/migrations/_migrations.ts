import type { Migration } from "./migrationTypes.js";
import { migration20260219ImportFiles } from "./20260219_import_files.js";
import { migration20260219Initial } from "./20260219_initial.js";

export const migrations: Migration[] = [
  migration20260219Initial,
  migration20260219ImportFiles
];
