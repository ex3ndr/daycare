import type { Migration } from "./migrationTypes.js";

export const migrations: Migration[] = [
    {
        name: "20260226_bootstrap",
        fileName: "20260226_bootstrap.sql"
    },
    {
        name: "20260227_user_profile",
        fileName: "20260227_user_profile.sql"
    },
    {
        name: "20260227_webhook_triggers",
        fileName: "20260227_webhook_triggers.sql"
    },
    {
        name: "20260228_timezones",
        fileName: "20260228_timezones.sql"
    },
    {
        name: "20260227_task_parameters",
        fileName: "20260227_task_parameters.sql"
    },
    {
        name: "20260228_webhook_last_run",
        fileName: "20260228_webhook_last_run.sql"
    },
    {
        name: "20260228_entity_versioning",
        fileName: "20260228_entity_versioning.sql"
    },
    {
        name: "20260228_tasks_drop_deleted_at",
        fileName: "20260228_tasks_drop_deleted_at.sql"
    },
    {
        name: "20260228_user_connector_keys_cleanup",
        fileName: "20260228_user_connector_keys_cleanup.sql"
    },
    {
        name: "20260228_observation_log",
        fileName: "20260228_observation_log.sql"
    },
    {
        name: "20260228_documents",
        fileName: "20260228_documents.sql"
    },
    {
        name: "20260301_drop_legacy_task_trigger_table",
        fileName: "20260301_drop_legacy_task_trigger_table.sql"
    },
    {
        name: "20260301_swarms",
        fileName: "20260301_swarms.sql"
    },
    {
        name: "20260301_agent_paths",
        fileName: "20260301_agent_paths.sql"
    }
];
