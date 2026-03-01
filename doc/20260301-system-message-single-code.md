# System Message Executable Simplification

## Summary

Executable `system_message` handling now runs only when `code` is present.

Changes:
- Removed `execute` flag usage from `system_message` payloads.
- Removed `<run_python>...</run_python>` text fallback for `system_message` execution.
- Enforced a single executable payload (`code: string`) instead of multiple code blocks.
- Updated cron/webhook/task producers to send `code` as a single string.
- Kept execution on the same unified `agentLoopRun` restore-only VM path.

## Flow

```mermaid
flowchart TD
  A[Incoming system_message] --> B{code present?}
  B -->|no| C[Normal system message path]
  B -->|yes| D[Validate code is single string]
  D -->|invalid| E[Return responseError + executionErrorText]
  D -->|valid| F[Run code via agentLoopRun restore-only]
  F --> G{sync?}
  G -->|yes| H[Return output directly]
  G -->|no| I[Append output to system text]
  I --> C
```
