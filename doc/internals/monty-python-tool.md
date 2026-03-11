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
The plugin imports `@pydantic/monty` through the package entrypoint at runtime.
With `@pydantic/monty@0.0.8`, the shipped runtime exposes `typing`, `os`,
`pathlib`, `sys`, `math`, and `re`.
`os.environ` stays unavailable in standard execution, so Python snippets cannot
read host process environment variables directly.

```mermaid
flowchart TD
  Agent[Agent tool call] --> PythonTool[python tool]
  PythonTool --> MontyPackage[@pydantic/monty package entrypoint]
  MontyPackage --> Runtime[Monty interpreter]
  Runtime -->|success| Output[toolResult output]
  Runtime -->|parse/type/runtime error| Error[toolResult isError]
```
