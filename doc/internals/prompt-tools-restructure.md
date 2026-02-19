# Prompt Tools Restructure

RLM tool-mode prompt text now lives in bundled markdown templates:

- `sources/prompts/SYSTEM_TOOLS_RLM.md` for `run_python` tool-call mode
- `sources/prompts/SYSTEM_TOOLS_RLM_INLINE.md` for no-tools `<run_python>` tag mode

Both builders inject only the Python prompt preamble (`{{{preamble}}}`) and no longer include
skill lists. Skills are appended once after rendering `SYSTEM_SKILLS.md`.
For no-tools tag mode, Python execution guidance is merged into one block before
the generated function list in `SYSTEM_TOOLS_RLM_INLINE.md`.

Runtime execution now uses a separate minimal Monty preamble (`montyRuntimePreambleBuild`)
without prompt comments/stubs.

```mermaid
flowchart TD
  A[ToolResolver.listTools] --> B[montyPreambleBuild<br/>prompt preamble]
  A --> R[montyRuntimePreambleBuild<br/>runtime preamble]
  B --> C[SYSTEM_TOOLS_RLM.md]
  B --> D[SYSTEM_TOOLS_RLM_INLINE.md]
  D --> D1[Single execution guidance block<br/>before functions list]
  C --> E[rlmToolDescriptionBuild]
  D --> F[rlmNoToolsPromptBuild]
  R --> X[rlmTool + no-tools run_python execution]
  E --> G[toolListContextBuild rlm mode]
  F --> H[Agent noToolsPrompt]
  X --> L[rlmExecute]
  I[skillPromptFormat<br/>dynamic available_skills list only] --> J[Appended after SYSTEM_SKILLS.md render]
  G --> K[Rendered system prompt]
  H --> K
  J --> K
```
