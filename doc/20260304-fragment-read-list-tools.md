# Fragment Read/List Tools

## Summary

Added two read-only core tools for fragment inspection:

- `fragment_read`: reads one fragment by `fragmentId`, including archived rows, and returns full fragment data with `spec`.
- `fragment_list`: lists active non-archived fragments for the current user without returning `spec`.

Both tools are registered in `Engine` core tool setup.

## Flow

```mermaid
flowchart TD
    A[Agent calls fragment_read] --> B[findAnyById(ctx, fragmentId)]
    B --> C{Found?}
    C -- no --> D[Return summary + fragment: null]
    C -- yes --> E[Return summary + full fragment payload with spec]

    F[Agent calls fragment_list] --> G[findAll(ctx)]
    G --> H[Filter is repository-level active non-archived rows]
    H --> I[Return summary + fragment array without spec]
```
