# Monty Python plugin

## Overview
The Monty Python plugin registers a `python` tool that runs sandboxed Python snippets using `@pydantic/monty`.

## Tool
- `python`
  - Params: `code`, optional `inputs`, optional `typeCheck`, optional `scriptName`, optional `limits`
  - Returns the evaluated output from the Python snippet.
  - Returns a structured tool error for parse, type-check, and runtime failures.

## Notes
- The plugin imports `@pydantic/monty` through the package entrypoint at runtime.
- Supported built-in modules in the shipped runtime are `typing`, `os`, `pathlib`, `sys`, `math`, and `re`.
- `os.environ` remains unavailable during normal execution, so host environment variables are not exposed to Python snippets.
