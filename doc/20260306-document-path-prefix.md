# Document Path Prefix

This change makes vault paths require the explicit `vault://` prefix instead of reusing filesystem-style `~/...`.

## What Changed

- Vault path parsing now accepts only `vault://...`
- Vault path rendering now emits `vault://...`
- Vault tools and prompts now instruct models to use `vault://system/*`, `vault://memory/*`, and similar vault paths
- Wiki-link path references now resolve only when written as `[[vault://...]]`
- Bare wiki links remain document IDs only; implicit path fallback was removed

## Why

Using `~/...` for both the sandbox filesystem and the vault made the model conflate two different storage systems. `vault://...` is visibly distinct and avoids accidental filesystem reads and writes when the intent is to use vault tools.

## Flow

```mermaid
flowchart TD
    A[Model wants vault context] --> B{Path starts with vault://?}
    B -- yes --> C[Resolve vault path in storage]
    B -- no --> D[Treat as document id or reject path]
    C --> E[vault_read / vault_write / vault_patch / vault_append]
    D --> F[No implicit filesystem-style vault path parsing]
```

## Wiki Links

```mermaid
flowchart LR
    A[[vault://memory/user]] --> B[Resolve as vault path]
    C[[memory/user]] --> D[Ignored as path]
    E[[doc-id]] --> F[Resolve as explicit document id]
```
