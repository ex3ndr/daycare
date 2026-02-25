# Executable Prompts Module

This module expands `<run_python>...</run_python>` blocks inside system prompt text before the prompt is sent to inference.

## Behavior

- Uses `tagExtractAll()` to read all `<run_python>` blocks.
- Executes each block through `rlmExecute()` with full tool access.
- Replaces each original tag block with execution output.
- On execution failure, replaces the block with:
  - `<exec_error>error message</exec_error>`
- Expansion is single-pass only. If output contains another `<run_python>` tag, it is not executed again in the same call.

## RLM Dependency

Expansion runs whenever the caller enables executable prompt handling.
Inline-RLM is the only execution mode.

## Example

Input:

```text
Check status:
<run_python>
1 + 1
</run_python>
Done.
```

Expanded:

```text
Check status:
2
Done.
```

Failure case:

```text
Check status:
<exec_error>SyntaxError: ...</exec_error>
Done.
```
