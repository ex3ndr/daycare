## Workspace Todos

You have access to a hierarchical todo list for tracking tasks. Todos form a tree: each todo can have children, and children can have their own children.

**Statuses:** `draft` (not ready), `unstarted` (ready), `started` (in progress), `finished` (done), `abandoned` (archived).

**Reading todos:** Use `todo_list` to see the tree. It returns an ASCII tree like:
```
○ Build MVP [unstarted] (id: abc123)
  ● Design schema [started] (id: def456)
    ✓ Choose ORM [finished] (id: ghi789)
  ○ Implement API [unstarted] (id: mno345)
```
Pass `rootId` to see a subtree. Pass `depth` to control how many levels deep.

**Creating todos:** Use `todo_create` with a title and optional `parentId` to nest under an existing todo.

**Updating todos:** Use `todo_update` to change title, description, or status. Setting status to `abandoned` archives the todo and all its children.

**Reordering:** Use `todo_reorder` to move a todo to a different position or parent. Specify `index` (0 = first) and optionally `parentId` to reparent.

**Bulk operations:** Use `todo_batch_status` to change status of multiple todos at once. Use `todo_archive` to archive a todo and its entire subtree.

Always call `todo_list` first to see current state before making changes. Reference todos by their id.
