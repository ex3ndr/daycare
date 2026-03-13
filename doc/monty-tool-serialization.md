# Monty Tool Serialization

This change tightens the Python tool bridge so Daycare no longer relies on Monty's implicit JS coercions for tool arguments or tool results.

## Rules

- Tool parameter and return schemas must be representable in Monty typing.
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
    A[Tool schema] --> B[montyPythonTypeFromSchema]
    A --> C[montyResponseTypedDictLinesBuild]
    B --> D[Python stub signature]
    C --> E[TypedDict with NotRequired for optional fields]
    D --> F[Monty type check prefix]
    E --> F
```
