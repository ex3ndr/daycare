# Executable Prompts

Cron and heartbeat prompts now use existing `system_message` inbox items with an optional `execute` flag.

## Flow

```mermaid
flowchart TD
  Cron[Cron task] --> PostCron["post system_message<br/>execute=true origin=cron"]
  Heartbeat[Heartbeat batch] --> PostHeartbeat["post system_message<br/>execute=true origin=heartbeat"]
  PostCron --> Agent[Agent.handleSystemMessage]
  PostHeartbeat --> Agent
  Agent --> Gate{execute}
  Gate -- no --> Raw[Forward raw prompt text]
  Gate -- yes --> Expand[executablePromptExpand]
  Expand --> Run["run each <run_python> via rlmExecute"]
  Run --> Skip{"skip() called?"}
  Skip -- yes --> Abort[Abort — no inference]
  Skip -- no --> Replace[Replace tag blocks with output]
  Run --> Error["on failure: <exec_error>...</exec_error>"]
  Replace --> Forward[Forward expanded system message]
  Error --> Forward
```

## Skip during expansion

Calling `skip()` inside a `<run_python>` block during prompt expansion aborts the entire system message. No inference runs and `handleSystemMessage` returns `null`. Remaining `<run_python>` blocks are not executed.
`skip()` is exposed as an inline-RLM control function (synthetic runtime function), not as a separately registered classical tool.

## History persistence

Agent history no longer stores classical tool-calling message records (`tool_result`) or assistant `toolCalls`.
Only user/assistant text plus RLM checkpoint records are persisted.

```mermaid
flowchart TD
  A[assistant response] --> B[assistant_message text/files/tokens]
  A --> C{contains run_python?}
  C -- no --> D[history append complete]
  C -- yes --> E[append rlm_start/tool_call/tool_result/complete]
  E --> D
  F[restore on crash] --> G[append user_message origin=rlm_restore]
```
