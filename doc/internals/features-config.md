# Runtime Execution Mode

Daycare no longer uses `features` flags for operation-mode selection.

## Current behavior

- Inference receives zero classical tools.
- Python runs only through inline `<run_python>...</run_python>` blocks.
- Foreground delivery uses `<say>...</say>` blocks.

## Flow

```mermaid
flowchart TD
  A[Assistant response] --> B[Extract say blocks]
  A --> C[Extract run_python blocks]
  C --> D{Any run_python?}
  D -->|No| E[End turn]
  D -->|Yes| F[rlmExecute each block]
  F --> G[Inject python_result user message]
  G --> H[Next inference iteration]
```

## Configuration

The removed keys are ignored:

- `features.say`
- `features.rlm`
- `features.noTools`
