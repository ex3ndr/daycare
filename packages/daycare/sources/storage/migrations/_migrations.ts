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
    }
];
