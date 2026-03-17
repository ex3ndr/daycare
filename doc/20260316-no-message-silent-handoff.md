# Silent Handoff Prompt Tightening

This change tightens the foreground prompt so a silent background delegation stays fully silent:

- launch background work first
- avoid pre-tool narration like "I'll investigate"
- return exactly `NO_MESSAGE` when there is nothing user-visible to say

## Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Foreground agent
    participant P as run_python
    participant B as Background agent

    U->>F: Investigate and report back
    F->>P: first action launches start_background_agent(...)
    P->>B: start background investigator
    B-->>F: will report later via agent message
    F-->>U: NO_MESSAGE
```

## Prompt effect

The prompt now makes two constraints explicit:

1. The first substantive foreground action for non-trivial investigation should be starting background work, including when that launch happens inside `run_python`.
2. If the agent intends to end the turn with `NO_MESSAGE`, it must not emit any user-facing setup narration anywhere else in the turn.
