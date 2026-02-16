# Signal Events CSV Tool

`signal_events_csv` reads persisted signal events and returns CSV for downstream analysis.

- `fromAt`: optional lower bound (inclusive), unix milliseconds
- `toAt`: optional upper bound (inclusive), unix milliseconds
- `types`: optional list of exact signal event types
- when both `fromAt` and `toAt` are provided, `fromAt` must be `<= toAt`
- output columns are always:
  - `event_type`
  - `args` (JSON string for the signal `data` payload, `null` when absent)
  - `unix_time`
  - `ai_friendly_time` (ISO-8601 timestamp)

```mermaid
sequenceDiagram
  participant Agent as Calling Agent
  participant Tool as signal_events_csv
  participant Signals as Signals Facade
  participant Disk as signals/events.jsonl
  Agent->>Tool: fromAt/toAt/types (optional)
  Tool->>Tool: validate range and normalize type filters
  Tool->>Signals: listAll()
  Signals->>Disk: read events.jsonl
  Disk-->>Signals: raw jsonl lines
  Signals-->>Tool: Signal[]
  Tool->>Tool: filter by unix time + event type
  Tool->>Tool: build CSV rows
  Tool-->>Agent: CSV text + filter metadata
```
