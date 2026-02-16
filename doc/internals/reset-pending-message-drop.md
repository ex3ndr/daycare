# Reset Pending Message Drop

The reset command now clears queued, debounced connector messages for the same descriptor before posting the reset event.

## Why
- Connector message batching uses a debounce window.
- A message sent just before `/reset` could still be queued and merged into the first post-reset message.
- This produced cross-session leakage in the first reply after reset.

## Change
- Added `IncomingMessages.dropForDescriptor(descriptor)` to remove queued (not yet flushed) items for one descriptor.
- `Engine.handleResetCommand()` now calls this drop method before enqueuing reset.
- Added regression tests for both `IncomingMessages` and `Engine` reset command flow.

## Flow
```mermaid
flowchart LR
  A[Queued debounced messages] --> B[/reset command]
  B --> C[dropForDescriptor(descriptor)]
  C --> D[Post reset inbox item]
  D --> E[Next user message]
  E --> F[Clean post-reset context]
```
