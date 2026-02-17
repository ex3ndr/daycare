# Daycare RLM `<say>` + `<run_python>` Flow

## Summary

In no-tools RLM mode, `<say>` blocks are now split around the last `</run_python>` tag:
- `<say>` before `</run_python>` is sent immediately.
- `<say>` after `</run_python>` is buffered and sent only when Python execution succeeds.
- On execution failure, assistant text after the last `</run_python>` is removed from in-memory context before the next model turn.

This keeps user-visible messages aligned with actual execution state without mutating persisted history records.

## Sequence

```mermaid
sequenceDiagram
  participant M as Model
  participant L as agentLoopRun
  participant P as rlmExecute
  participant U as User Connector

  M->>L: assistant text with <say> + <run_python>
  L->>L: split text at last </run_python>
  L->>U: send pre-run <say> blocks
  L->>P: execute extracted run_python code
  alt execution success
    P-->>L: result
    L->>U: send buffered post-run <say> blocks
    L->>M: add <python_result> success message
  else execution failure
    P-->>L: error
    L->>L: truncate in-memory assistant text at </run_python>
    L->>M: add <python_result> error message
  end
```
