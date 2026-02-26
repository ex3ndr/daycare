# RLM Per-Agent Workers

## Overview

RLM (`run_python`) now isolates Monty VM execution in dedicated child processes managed by `RlmWorkers`.

Key behavior:
- worker key is derived from execution context (`ctx.userId` + optional `ctx.agentId`)
- each key gets its own worker process
- `rlmStepStart()` and `rlmStepResume()` execute in the keyed worker
- host process still performs tool dispatch (`rlmStepToolCall`) and history writes

## Why

Monty can fail at runtime. Running VM segments in child processes isolates failures from the main Daycare server process and prevents whole-process crashes.

## Flow

```mermaid
sequenceDiagram
    participant Agent as Agent Loop / rlmExecute
    participant Workers as RlmWorkers (host)
    participant WorkerA as Monty Worker (user-1:agent-1)
    participant Tools as ToolResolver (host)

    Agent->>Workers: rlmStepStart(workerKey, code, preamble, limits)
    Workers->>WorkerA: start request
    WorkerA-->>Workers: paused snapshot (functionName, args, kwargs, snapshotDump)
    Workers-->>Agent: paused VM state

    Agent->>Tools: rlmStepToolCall(snapshot args)
    Tools-->>Agent: toolResult + isError

    Agent->>Workers: rlmStepResume(workerKey, snapshotDump, returnValue/exception)
    Workers->>WorkerA: resume request
    WorkerA-->>Workers: paused snapshot or complete output
    Workers-->>Agent: VM progress
```

## Crash Handling

```mermaid
flowchart TD
    A[Worker exits unexpectedly] --> B[RlmWorkers removes worker for key]
    B --> C[Reject in-flight requests for that key]
    C --> D[Host process continues running]
    D --> E[Next request for key]
    E --> F[Spawn fresh worker]
```
