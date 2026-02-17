# Prompt Tools Restructure

RLM tool-mode prompt text now lives in bundled markdown templates:

- `sources/prompts/SYSTEM_TOOLS_RLM.md` for `run_python` tool-call mode
- `sources/prompts/SYSTEM_TOOLS_RLM_INLINE.md` for no-tools `<run_python>` tag mode

Both builders inject only the Python preamble (`{{{preamble}}}`) and no longer include
skill lists. Skills are injected once through `skillsPrompt` in `SYSTEM.md`.

```mermaid
flowchart TD
  A[ToolResolver.listTools] --> B[rlmPreambleBuild]
  B --> C[SYSTEM_TOOLS_RLM.md]
  B --> D[SYSTEM_TOOLS_RLM_INLINE.md]
  C --> E[rlmToolDescriptionBuild]
  D --> F[rlmNoToolsPromptBuild]
  E --> G[toolListContextBuild rlm mode]
  F --> H[Agent noToolsPrompt]
  I[skillPromptFormat] --> J[SYSTEM.md skillsPrompt]
  G --> K[Rendered system prompt]
  H --> K
  J --> K
```
