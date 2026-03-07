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
    },
    {
        name: "20260304101500_psql_databases",
        fileName: "20260304101500_psql_databases.sql"
    },
    {
        name: "20260304120000_fragments",
        fileName: "20260304120000_fragments.sql"
    },
    {
        name: "20260307170000_model_role_rules_reasoning",
        fileName: "20260307170000_model_role_rules_reasoning.sql"
    },
    {
        name: "20260307183000_app_auth_tables",
        fileName: "20260307183000_app_auth_tables.sql"
    },
    {
        name: "20260307190000_workspace_members",
        fileName: "20260307190000_workspace_members.sql"
    },
    {
        name: "20260306120000_swarm_to_workspace",
        fileName: "20260306120000_swarm_to_workspace.sql"
    },
    {
        name: "20260306130000_user_emoji",
        fileName: "20260306130000_user_emoji.sql"
    }
];
