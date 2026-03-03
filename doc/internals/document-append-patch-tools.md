# Document Append and Patch Tools

Added two core tools for incremental document updates without rewriting the whole body:

- `document_append`: appends raw text to the end of an existing document body.
- `document_patch`: applies an exact-text patch object `{ search, replace, replaceAll? }`.

Both tools:

- resolve targets by `documentId` or `path` (`~/...`)
- run user-scoped document lookup via `ctx`
- enforce memory-agent write scope (`~/memory` subtree only)
- validate people document frontmatter rules before saving
- return `{ summary, documentId, version }` (+ patch counts for `document_patch`)

```mermaid
flowchart TD
  A[Tool call: document_append or document_patch] --> B[Resolve target by documentId/path]
  B --> C{Target exists?}
  C -- no --> D[Throw not found]
  C -- yes --> E[Memory scope assert for memory agents]
  E --> F[Compute next body append or patch]
  F --> G[peopleDocumentFrontmatterAssert]
  G --> H[storage.documents.update with ctx]
  H --> I[Return tool summary + new version]
```
