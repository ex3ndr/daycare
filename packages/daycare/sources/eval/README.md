# Eval Harness

The eval harness runs scripted conversations against Daycare agents fully in-process. It boots `AgentSystem` with:

- in-memory PGlite via `storageOpenTest()`
- a temp runtime directory for user homes and auth files
- synchronous message delivery through `AgentSystem.postAndAwait()`
- trace collection from `agentHistoryLoad()` and `EngineEventBus`
- live configured providers by default in the CLI path

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

Scenarios may also define scripted mock inference:

```json
{
    "inference": {
        "type": "scripted",
        "calls": [
            {
                "branches": [
                    {
                        "whenSystemPromptIncludes": ["start_background_agent"],
                        "toolCall": {
                            "id": "tool-1",
                            "name": "start_background_agent",
                            "arguments": {
                                "prompt": "Investigate this request."
                            }
                        }
                    },
                    {
                        "message": "fallback"
                    }
                ]
            }
        ]
    }
}
```

This keeps prompt-sensitive evals inside the normal `yarn eval` flow without requiring a custom test harness. When `inference` is omitted, the CLI uses live configured providers.

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
Assistant tool calls are rendered in the trace so tool-driven runs remain inspectable.
