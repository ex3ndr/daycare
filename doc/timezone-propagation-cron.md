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

## Shared timezone helpers

- Extracted `timezoneIsValid()` to `sources/util/timezoneIsValid.ts`.
- Extracted cron fallback logic to `sources/engine/cron/ops/cronTimezoneResolve.ts`.
- `CronScheduler` and task tools now use the same resolver to avoid drift.

```mermaid
flowchart LR
    A[task.ts] --> C[cronTimezoneResolve]
    B[cronScheduler.ts] --> C
    C --> D[timezoneIsValid]
    C --> E[Resolved timezone]
```

## Connector timezone sync

- Incoming connector timezone is compared with `users.timezone` from profile.
- When values differ, runtime updates `users.timezone` automatically and emits a context enrichment notice.
- When user names are missing, runtime emits a profile-name context enrichment notice.
- Enrichments are stored as structured `{ key, value }` entries in message context and persisted in history records.
- Invalid incoming/profile timezone strings are ignored.

```mermaid
flowchart TD
    A[Incoming connector message] --> B{context.timezone valid?}
    B -- yes --> C{Differs from users.timezone?}
    C -- yes --> D[Auto-update users.timezone]
    D --> E[Add timezone_change_notice enrichment]
    C -- no --> F[Skip timezone update]
    A --> G{firstName/lastName missing?}
    G -- yes --> H[Add profile_name_notice enrichment]
    G -- no --> I[No profile notice]
    B -- no --> J[Keep existing valid profile timezone]
    E --> K[Persist enrichments in user_message history]
    F --> K
    H --> K
    I --> K
    J --> K
    K --> L[Rebuild tags precisely during history replay]
```

## Strict timezone requirement for cron tool calls

- `task_create` and `task_trigger_add` now require resolvable timezone:
  - explicit timezone argument, or
  - valid profile timezone.
- If neither exists, tool call throws and the model must ask user for timezone.
