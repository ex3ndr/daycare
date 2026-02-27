# Timezone Propagation Across Profile, Messages, and Cron

## What changed

- Added `timezone` to user profile storage and `user_profile_update` tool.
- Added timezone metadata to connector/system message context and incoming message formatting.
- Added timezone-aware cron triggers (`tasks_cron.timezone`) with profile-based defaults.
- Added timezone to system prompt environment identity section.

## Runtime flow

```mermaid
flowchart TD
    A[user_profile_update] --> B[users.timezone]
    B --> C[Engine message context enrichment]
    C --> D[messageFormatIncoming]
    D --> E[Formatted tags: timezone + time + message_id]

    B --> F[task_trigger_add/task_create]
    F --> G[tasks_cron.timezone]
    G --> H[CronScheduler]
    H --> I[cronTimeGetNext(schedule, timezone)]
    H --> J[system_message context.timezone]

    B --> K[agentSystemPromptSectionEnvironment]
    K --> L[SYSTEM_ENVIRONMENT.md Identity section]
```

## Cron timezone resolution rules

- If a cron timezone is provided explicitly, it must be a valid IANA timezone.
- If omitted, cron defaults to the user profile timezone when present and valid.
- If no profile timezone exists, cron falls back to `UTC`.
