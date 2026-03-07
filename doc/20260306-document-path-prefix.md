# Document Path Prefix

This change makes document-store paths require the explicit `doc://` prefix instead of reusing filesystem-style `~/...`.

## What Changed

- Document path parsing now accepts only `doc://...`
- Document path rendering now emits `doc://...`
- Document tools and prompts now instruct models to use `doc://system/*`, `doc://memory/*`, and similar document-store paths
- Wiki-link path references now resolve only when written as `[[doc://...]]`
- Bare wiki links remain document IDs only; implicit path fallback was removed

## Why

Using `~/...` for both the sandbox filesystem and the document store made the model conflate two different storage systems. `doc://...` is visibly distinct and avoids accidental filesystem reads and writes when the intent is to use document tools.

## Flow

```mermaid
flowchart TD
    A[Model wants document context] --> B{Path starts with doc://?}
    B -- yes --> C[Resolve document path in storage]
    B -- no --> D[Treat as document id or reject path]
    C --> E[document_read / document_write / document_patch / document_append]
    D --> F[No implicit filesystem-style document path parsing]
```

## Wiki Links

```mermaid
flowchart LR
    A[[doc://memory/user]] --> B[Resolve as document path]
    C[[memory/user]] --> D[Ignored as path]
    E[[doc-id]] --> F[Resolve as explicit document id]
```
