# Hourly Token Stats

Daycare now persists model usage into an hourly rollup table so dashboard analytics can be filtered by user, agent, and model.

## Data Model

Each row in `token_stats_hourly` is unique by:
- `hour_start` (unix ms floored to hour)
- `user_id`
- `agent_id`
- `model` (full string, `provider/model`)

Tracked values:
- `input_tokens`
- `output_tokens`
- `cache_read_tokens`
- `cache_write_tokens`
- `cost`

Token buckets stay exclusive. For total views:
- input total = `input_tokens + cache_read_tokens`
- output total = `output_tokens + cache_write_tokens`

## Flow

```mermaid
sequenceDiagram
  participant Inference as Inference Router
  participant Loop as agentLoopRun
  participant Agent as Agent.handleMessage
  participant DB as token_stats_hourly
  participant API as /v1/engine/token-stats
  participant UI as Dashboard

  Inference->>Loop: assistant message + usage + cost
  Loop->>Agent: tokenStatsUpdates[{ at, provider, model, tokens, cost }]
  Agent->>DB: UPSERT increment per (hour,user,agent,model)
  UI->>API: GET token stats with filters
  API->>DB: SELECT hourly rows
  DB-->>API: filtered rows
  API-->>UI: rows (tokens + cost)
```

## API

`GET /v1/engine/token-stats`

Query filters:
- `from` (unix ms)
- `to` (unix ms)
- `userId`
- `agentId`
- `model`
- `limit`

Response rows include hour bucket, identity keys, exclusive token buckets, and cost.
