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
        name: "20260308090000_remove_user_is_owner",
        fileName: "20260308090000_remove_user_is_owner.sql"
    },
    {
        name: "20260308110000_rename_workspace_owner_id",
        fileName: "20260308110000_rename_workspace_owner_id.sql"
    },
    {
        name: "20260306120000_swarm_to_workspace",
        fileName: "20260306120000_swarm_to_workspace.sql"
    },
    {
        name: "20260306130000_user_emoji",
        fileName: "20260306130000_user_emoji.sql"
    },
    {
        name: "20260308090000_user_configuration",
        fileName: "20260308090000_user_configuration.sql"
    },
    {
        name: "20260308093000_user_configuration_ready_flags",
        fileName: "20260308093000_user_configuration_ready_flags.sql"
    },
    {
        name: "20260308120000_todos",
        fileName: "20260308120000_todos.sql"
    },
    {
        name: "20260309090000_user_configuration_bootstrap_started",
        fileName: "20260309090000_user_configuration_bootstrap_started.sql"
    }
];
