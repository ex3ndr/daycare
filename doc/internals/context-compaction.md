# Context compaction

Daycare runs automatic compaction to avoid hard context overflows. The agent estimates context usage
from recent history plus the current system prompt and compacts when thresholds are crossed.

## Strategy

- Warning threshold: 75% of `settings.agents.emergencyContextLimit`.
- Critical threshold: 90% of `settings.agents.emergencyContextLimit`.
- Estimates include history plus heuristic extras (system prompt, tool payloads, incoming raw text).
- When warning/critical, the agent notifies the user that compaction is starting, runs compaction
  immediately, and resumes inference with the compacted context.
- During compaction, connectors that support typing show a typing indicator.
- Compaction runs with an abort signal so `/abort` can interrupt in-flight compaction.

## Compaction summary handling

When compaction runs, the agent:
1) records a reset marker in history (with `Session context compacted.` message)
2) appends the compaction summary as a user message with an instruction to continue
3) resumes with the latest user message appended after the summary
4) appends a full inference trace to `agents/<agentId>/compaction_YYYYMMDD.md`

If compaction produces no summary text, no reset is applied and context remains unchanged.

## Flow

```mermaid
flowchart TD
  A[Incoming user message] --> B[Estimate history + heuristic extras]
  X[Extras: system prompt, tools, raw text] --> B
  B -->|Below warning| C[Run inference normally]
  B -->|Warning/critical| D[Send compaction start notice]
  D --> E[Start typing indicator]
  E --> F[Run compaction summary with AbortSignal]
  F --> G[Append compaction_YYYYMMDD.md log]
  G --> H{Summary text produced?}
  H -->|no| I[Keep full context]
  H -->|yes| J[Reset history + insert summary]
  I --> K[Stop typing + resume inference]
  J --> K[Stop typing + resume inference]
```

## Manual compaction command

Users can request manual compaction with `/compact`.

```mermaid
flowchart TD
  A[/compact command/] --> B[Resolve agent + connector]
  B --> C{Agent busy?}
  C -->|yes| D[Reply: busy]
  C -->|no| E[Start typing indicator]
  E --> F[Run compaction summary with AbortSignal]
  F --> G[Append compaction_YYYYMMDD.md log]
  G --> H{Summary produced?}
  H -->|no| I[Reply: empty summary]
  H -->|yes| J[Reset history + insert summary]
  J --> K[Reply: session compacted]
  F -->|aborted| L[Reply: compaction aborted]
```
