# Monty Tool Serialization

This change tightens the Python tool bridge so Daycare no longer relies on Monty's implicit JS coercions for tool arguments or tool results.

## Rules

- Tool parameter and return schemas must be representable in Monty typing.
- Runtime code that needs return typing now uses `ResolvedTool { tool, returns }` instead of hidden metadata on `Tool`.
- Unsupported schema fragments now fail registration or prompt generation instead of degrading to `Any`.
- Python `None` passed to optional tool arguments is treated as omission, not JSON `null`.
- Tool results are converted back to Python only from explicitly safe JS values.
- Uncastable values throw a tool error; they do not fall back to tool summary text.

## Flow

```mermaid
flowchart TD
    A[Python tool call] --> B[Monty snapshot args/kwargs]
    B --> C[rlmArgsConvert]
    C --> D[montyValueToJs]
    D --> E[Schema-checked JS args]
    E --> F[Tool execution]
    F --> G[typedResult or runtime helper value]
    G --> H[montyValueToPython]
    H --> I[Schema-checked Python-safe value]
    I --> J[Resume Monty VM]
    H --> K[ToolError on unsafe value]
```

## Typed Surface

```mermaid
flowchart LR
    A[ToolDefinition] --> B[ResolvedTool]
    B --> C[tool metadata]
    B --> D[return contract]
    C --> E[montyPythonTypeFromSchema]
    D --> F[montyResponseTypedDictLinesBuild]
    E --> G[Python stub signature]
    F --> H[TypedDict with NotRequired for optional fields]
    G --> I[Monty type check prefix]
    H --> I
```
