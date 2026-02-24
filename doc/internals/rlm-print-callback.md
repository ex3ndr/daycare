# RLM Print Callback

## Summary

RLM execution now uses Monty's native `print` callback instead of rewriting Python `print(...)` calls to a custom external function.

## Flow

```mermaid
sequenceDiagram
    participant Python as Python Script
    participant Monty as Monty Runtime
    participant RLM as RLM Print Capture
    participant History as Agent History

    Python->>Monty: print("hello", "world")
    Monty->>RLM: printCallback("stdout", "hello world\\n")
    RLM->>RLM: buffer chunks and split on newline
    RLM->>History: persist normalized line ("hello world")
```

## Notes

- Removed `__daycare_print__` preamble stubs and code rewrite logic.
- `rlmExecute` and `rlmRestore` pass `printCallback` into `start(...)` and `MontySnapshot.load(...)`.
- Print output remains available as normalized lines in `printOutput`.
