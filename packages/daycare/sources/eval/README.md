# Eval Harness

The eval harness runs scripted conversations against Daycare agents fully in-process. It boots `AgentSystem` with:

- in-memory PGlite via `storageOpenTest()`
- a temp runtime directory for user homes and auth files
- synchronous message delivery through `AgentSystem.postAndAwait()`
- trace collection from `agentHistoryLoad()` and `EngineEventBus`

## Scenario Format

```json
{
    "name": "greeting-test",
    "agent": {
        "kind": "agent",
        "path": "test-agent"
    },
    "turns": [
        { "role": "user", "text": "Hello, what can you do?" }
    ]
}
```

Supported direct agent kinds:

- `connector`
- `agent`
- `app`
- `cron`
- `task`
- `subuser`
- `supervisor`

`agent.path` is the single path segment passed into the relevant path builder. It must not contain `/`.

## Usage

From the repo root:

```bash
yarn eval path/to/scenario.json
```

Optional output path:

```bash
yarn eval path/to/scenario.json path/to/output.trace.md
```

The command writes a markdown trace report next to the scenario file by default as `<scenario-name>.trace.md`.
