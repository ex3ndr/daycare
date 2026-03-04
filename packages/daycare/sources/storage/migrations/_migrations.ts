import type { Migration } from "./migrationTypes.js";

export const migrations: Migration[] = [
    {
        name: "20260302165030_bootstrap",
        fileName: "20260302165030_bootstrap.sql"
    },
    {
        name: "20260303101000_user_key_values",
        fileName: "20260303101000_user_key_values.sql"
    },
    {
        name: "20260303120000_model_role_rules",
        fileName: "20260303120000_model_role_rules.sql"
    }
];
