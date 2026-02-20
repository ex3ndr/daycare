import { migration20260219ImportFiles } from "./20260219_import_files.js";
import { migration20260219Initial } from "./20260219_initial.js";
import { migration20260220AddUsers } from "./20260220_add_users.js";
import { migration20260220UsersBootstrap } from "./20260220_users_bootstrap.js";
import type { Migration } from "./migrationTypes.js";

export const migrations: Migration[] = [
    migration20260219Initial,
    migration20260219ImportFiles,
    migration20260220AddUsers,
    migration20260220UsersBootstrap
];
