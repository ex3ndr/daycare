# Monty Python tool

The `monty-python` plugin registers a `python` tool that executes sandboxed
Python code through `@pydantic/monty`.

## Parameters
- `code` (required): Python snippet to run.
- `inputs` (optional): object values injected as Python variables.
- `typeCheck` (optional): run Monty type checking before execution.
- `scriptName` (optional): filename label for diagnostics.
- `limits` (optional): resource limits (`maxDurationSecs`, `maxMemory`, etc.).

## Runtime loading
`@pydantic/monty@0.0.3` publishes a broken package root export (`wrapper.js`
missing). The tool resolves and imports `node_modules/@pydantic/monty/index.js`
directly so the plugin can run without patching dependencies.

```mermaid
flowchart TD
  Agent[Agent tool call] --> PythonTool[python tool]
  PythonTool --> MontyIndex[node_modules/@pydantic/monty/index.js]
  MontyIndex --> Runtime[Monty interpreter]
  Runtime -->|success| Output[toolResult output]
  Runtime -->|parse/type/runtime error| Error[toolResult isError]
```
