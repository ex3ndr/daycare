# Documents Refresh Scope Fix

The documents screen was issuing fetch and mutation requests against `activeId` from the workspace store.
During route refreshes, that store can lag behind the URL workspace and temporarily point at a different scope.
When that happened, the documents tree reloaded from the wrong workspace and only the system subtree appeared.

The fix makes the documents screen prefer the workspace from the current route and only fall back to `activeId`
when no route workspace is available.

```mermaid
flowchart TD
    A[Route /:workspace/documents] --> B[Resolve workspace scope]
    B --> C{Route workspace present?}
    C -->|Yes| D[Use route workspace for document API calls]
    C -->|No| E[Fallback to activeId from store]
    D --> F[Fetch and mutate correct document tree]
    E --> F
```
