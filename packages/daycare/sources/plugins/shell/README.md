# Shell Plugin

The shell plugin provides workspace file tools (`read`, `write`, `edit`, `pdf_process`), one-shot command execution (`exec`), and durable process management tools.

## Read Tool Notes

- `read` accepts relative and absolute paths.
- Text output supports `offset` (1-indexed line start) and `limit` (line count) for pagination.
- Text output is truncated to `2000` lines or `50KB` (whichever is hit first), with continuation hints.
- Supported image files (`jpg`, `png`, `gif`, `webp`) are returned as image content blocks.
- `pdf_process` extracts PDF text via `pdfjs-dist` and, for text-sparse/scanned files, can attach rendered page images.

## Durable Process Tools

- `process_start`: starts a sandboxed detached process and persists metadata under engine data dir.
- `process_list`: shows current process status (`running`, `stopped`, `exited`) and metadata.
- `process_get`: returns one process record by id, including absolute `logPath`.
- `process_stop`: stops one managed process by id.
- `process_stop_all`: stops all managed processes.

## Persistence Layout

Each managed process gets a folder under `<engine-data-dir>/processes/<process-id>/`:

- `record.json`: durable process metadata (pid, restart policy, state).
- `sandbox.json`: sandbox runtime config used for launch/restart.
- `process.log`: combined stdout/stderr stream.

## Lifecycle Notes

- Processes are spawned detached, so they survive engine restarts.
- On engine startup, records are rehydrated from disk and running pids are picked up.
- On engine startup, persisted pids are cleared when the current host boot time differs from the recorded boot time.
- If `keepAlive` is true and desired state is `running`, exited processes are restarted by a monitor loop with exponential backoff.
- `process_stop` and `process_stop_all` set desired state to `stopped` and terminate process groups.
