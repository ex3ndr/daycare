# Todo Feature Removal

Date: 2026-03-13

Removed the todo feature from the core runtime, app API, and app UI.

- Deleted all todo tools and their system-prompt guidance.
- Removed todo storage, API routes, and the `todos` database table via a new drop migration.
- Removed the dedicated todos screen and the `TodoList` fragment component from the app and fragment catalog.
- Updated public docs and fragment authoring guidance so todo-specific APIs and components are no longer advertised.

```mermaid
flowchart TD
    A[Todo feature surfaces] --> B[Engine tools removed]
    A --> C[API routes removed]
    A --> D[Storage repository and schema removed]
    A --> E[App todos screen removed]
    A --> F[TodoList fragment removed]
    D --> G[20260313110000_drop_todos.sql]
    C --> H[doc/APP_API.md updated]
    F --> I[doc/fragments.md and fragments-creator skill updated]
```
