import type { Migration } from "./migrationTypes.js";

export const migrations: Migration[] = [
    {
        name: "20260226_bootstrap",
        fileName: "20260226_bootstrap.sql"
    },
    {
        name: "20260227_user_profile",
        fileName: "20260227_user_profile.sql"
    }
];
