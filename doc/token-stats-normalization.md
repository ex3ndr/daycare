# Token Stats Numeric Normalization

## Problem

In production DB driver paths, token stats numeric fields can be returned as strings.
The repository previously accepted only `number`, so string numerics were normalized to `0`.
This could surface as broken or empty token usage in downstream APIs/UI.

## Change

- `TokenStatsRepository` now parses numeric strings before normalization.
- Empty or invalid string values still normalize to `0`.
- Added a repository regression test for DB rows with string numerics.

## Flow

```mermaid
flowchart TD
    A[DB row fields] --> B{Field type}
    B -->|number| C[numberParse => finite number]
    B -->|numeric string| D[numberParse => Number(trimmed)]
    B -->|empty/invalid| E[numberParse => null]
    C --> F[numberTokenNormalize / numberCostNormalize]
    D --> F
    E --> F
    F --> G[TokenStatsHourlyDbRecord with stable numeric values]
```
