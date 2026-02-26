# RLM Multiline Python Guidance

Updated prompt guidance for native `run_python` tool-calling and existing VM execution phases.

## Summary
- Replaced `<run_python>...</run_python>` text-tag parsing in the main inference loop with native assistant tool calls.
- Prompt now instructs models to call `run_python(code=...)` directly.
- `run_python` is synthetic for inference only; it is not registered as a normal `ToolDefinition`.
- Runtime still uses the same VM phases (`vm_start` -> `tool_call` -> `block_complete`) for execution.
- Each `run_python` call result is posted back as a `toolResult` message with the original assistant `toolCallId`.
- Assistant history now persists native assistant `toolCall` blocks on `assistant_message` records.
- Pending-phase restore reconstructs pending run_python queues from persisted assistant tool calls.
- History-to-context restore now replays persisted assistant `toolCall` blocks and matching `toolResult` blocks.
- If restore finds `rlm_start` without a snapshot, it appends synthetic `rlm_complete` error and still resumes inference.
- Pending-phase recovery reuses standard provider selection (role/model override), not an empty override list.
- Recovery is only triggered from the `restore` inbox item, which is enqueued at the front and processed first.
- Restore recovery uses the connector resolved from the agent source, so foreground replies are delivered normally.
- RLM history records (`rlm_start`, `rlm_tool_call`, `rlm_tool_result`, `rlm_complete`) remain intact.
- Unsupported tool calls in this mode return immediate tool-result errors so inference can recover and continue.

## Flow
```mermaid
flowchart TD
  U[Assistant response] --> A[Extract toolCall blocks]
  A --> B[Persist assistant_message + toolCalls]
  B --> C{run_python calls present?}
  C -- no --> D[Finish turn / send plain text]
  C -- yes --> E[Build block queue from run_python.code]
  E --> F[vm_start phase]
  F --> G[tool_call phase for runtime function dispatch]
  G --> H[block_complete phase]
  H --> I[Append rlm_complete history record]
  I --> J[Push toolResult message with original toolCallId]
  J --> K{More run_python calls in same response?}
  K -- yes --> F
  K -- no --> L[Continue inference loop]
  A --> M[Unsupported tool calls]
  M --> N[Push toolResult error]
  N --> L
  B --> O[On restore inbox item (processed first): rebuild pending blocks from assistant_message.toolCalls]
  O --> F
  O --> P[Replay assistant toolCall + toolResult into context]
  O --> Q[No snapshot: append synthetic rlm_complete error]
  Q --> L
```
