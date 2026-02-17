# RLM Multiline Python Guidance

Updated prompt guidance for inline RLM Python execution and response-tag handling.

## Summary
- Added inline-mode support for multiple `<run_python>` tags per assistant response.
- Added sequential execution semantics: execute in order and stop at first failed block.
- Added strict post-`<run_python>` `<say>` suppression with an explicit notice line.
- Rewrote assistant text in context history to remove `<say>` tags after `<run_python>`.
- On first failed `<run_python>` block, rewrote context history to drop everything after the failed block.
- Persisted explicit `assistant_rewrite` history events for each rewrite.
- Restore now replays `assistant_rewrite` events directly (no trim recomputation on load).
- Extracted trim logic into ops helpers:
  `agentMessageRunPythonSayAfterTrim()` and `agentMessageRunPythonFailureTrim(successfulExecutionCount)`.
- Updated inline prompt examples to show multi-tag execution and ignored post-run `<say>`.
- Clarified that tool calls return plain LLM strings, not structured payloads.
- Added test assertions so these instructions stay present.

## Flow
```mermaid
flowchart TD
  U[Assistant response] --> A[Collect run_python blocks in order]
  A --> B[Execute block 1]
  B --> C{Success?}
  C -- Yes --> D[Execute next block]
  C -- No --> E[Skip remaining blocks]
  D --> F[All blocks done]
  E --> G[Emit python_result with failure]
  F --> H[Emit python_result messages]
  U --> I[Detect say tags after first run_python]
  I --> J[Ignore those say tags]
  J --> K[Rewrite assistant history text]
  K --> N[Append assistant_rewrite event]
  K --> L[Prefix python_result: say after run_python was ignored]
  C -- No --> M[Rewrite history: cut text after failed block]
  M --> O[Append assistant_rewrite failure event]
  N --> P[Restore: replay assistant_rewrite events]
  O --> P
```
