# RLM Python Early Validation

This change adds `rlmVerify(code, ctx)` for Monty-only static verification at task creation time.

## Behavior

- `rlmVerify` receives Python code and the target execution context.
- It resolves visible tools for that target context, builds a Monty preamble, and runs `typeCheck` without execution.
- It throws on syntax/type issues (for example unresolved function calls or unresolved imports).
- Verification is called from `task_create` only, not from normal `run_python` execution.

## Flow

```mermaid
flowchart TD
    A[task_create receives code] --> B[Resolve target ctx]
    B --> C[rlmVerify(code, ctx)]
    C --> D[Resolve tools for ctx]
    D --> E[Build Monty preamble]
    E --> F[Monty typeCheck only]
    F -->|error| G[Throw and reject task creation]
    F -->|ok| H[Persist task and triggers]
```
