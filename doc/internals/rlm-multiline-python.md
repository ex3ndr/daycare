# RLM Multiline Python Guidance

Updated prompt guidance for inline RLM Python execution and response-tag handling.

## Summary
- Added inline-mode support for multiple `<run_python>` tags per assistant response.
- Added sequential execution semantics: execute in order and stop at first failed block.
- Added strict post-`<run_python>` `<say>` suppression with an explicit notice line.
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
  J --> K[Prefix python_result: say after run_python was ignored]
```
