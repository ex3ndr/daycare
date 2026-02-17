# RLM noTools Tag Mode

Tag mode is enabled only when `features.noTools`, `features.rlm`, and `features.say` are all true.
In that mode, the model cannot call tools directly.
Instead, it emits Python in `<run_python>...</run_python>`, and the agent loop executes that
code with Monty via `rlmExecute()`.

## Flow

```mermaid
sequenceDiagram
  participant M as Model
  participant L as agentLoopRun
  participant R as rlmExecute (Monty)
  participant T as ToolResolver

  L->>M: System prompt + no tools + Python stubs
  M-->>L: Assistant text with <run_python>...</run_python>
  L->>L: rlmNoToolsExtract()
  L->>R: Execute extracted code + preamble
  R->>T: Execute inner tool calls
  T-->>R: Tool results
  R-->>L: output/print/toolCallCount
  L->>M: User message <python_result>...</python_result>
  M-->>L: Next assistant turn (repeat until no <run_python>)
```

## Key Files

- `packages/daycare/sources/engine/modules/rlm/rlmNoToolsPromptBuild.ts`
- `packages/daycare/sources/engine/modules/rlm/rlmNoToolsExtract.ts`
- `packages/daycare/sources/engine/modules/rlm/rlmNoToolsResultMessageBuild.ts`
- `packages/daycare/sources/engine/agents/ops/agentLoopRun.ts`
- `packages/daycare/sources/engine/modules/rlm/rlmExecute.ts`

## Notes

- Tool exposure is empty when `noTools` is true (`toolListContextBuild()` early return).
- `<say>` processing runs before `<run_python>` extraction, so user-facing say blocks are preserved.
- Checkpointing uses generated `toolCallId` values and reuses `appendHistoryRecord` callbacks.
