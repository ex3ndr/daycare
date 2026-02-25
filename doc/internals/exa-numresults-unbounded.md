# Exa `numResults` Unbounded

`exa_search` no longer enforces a hard upper limit for `numResults` in the Daycare tool schema.

- Before: `numResults` accepted `1..10`.
- After: `numResults` accepts `>= 1`.

The request value is forwarded to Exa as-is; provider-side limits remain enforced by Exa.

```mermaid
flowchart TD
    A[LLM calls exa_search] --> B{numResults provided?}
    B -->|no| C[Default to 5]
    B -->|yes| D[Validate minimum 1]
    C --> E[POST /search to Exa API]
    D --> E
    E --> F[Exa applies provider-side limits]
    F --> G[Return formatted results]
```
