# RLM Multiline Python Guidance

Updated prompt guidance for native `run_python` tool-calling and existing VM execution phases.

## Summary
- Replaced `<run_python>...</run_python>` text-tag parsing in the main inference loop with native assistant tool calls.
- Prompt now instructs models to call `run_python(code=...)` directly.
- Runtime still uses the same VM phases (`vm_start` -> `tool_call` -> `block_complete`) for execution.
- Each `run_python` call result is posted back as a `toolResult` message with the original assistant `toolCallId`.
- RLM history records (`rlm_start`, `rlm_tool_call`, `rlm_tool_result`, `rlm_complete`) remain intact.
- Unsupported tool calls in this mode return immediate tool-result errors so inference can recover and continue.

## Flow
```mermaid
flowchart TD
  U[Assistant response] --> A[Extract toolCall blocks]
  A --> B{run_python calls present?}
  B -- no --> C[Finish turn / send plain text]
  B -- yes --> D[Build block queue from run_python.code]
  D --> E[vm_start phase]
  E --> F[tool_call phase for runtime function dispatch]
  F --> G[block_complete phase]
  G --> H[Append rlm_complete history record]
  H --> I[Push toolResult message with original toolCallId]
  I --> J{More run_python calls in same response?}
  J -- yes --> E
  J -- no --> K[Continue inference loop]
  A --> L[Unsupported tool calls]
  L --> M[Push toolResult error]
  M --> K
```
