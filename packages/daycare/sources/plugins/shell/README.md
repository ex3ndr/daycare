# Shell Plugin

The shell plugin provides workspace file tools (`read`, `read_json`, `write`, `edit`, `write_output`), search/list helpers
(`grep`, `find`, `ls`), one-shot command execution (`exec`), and durable process management tools.

## Filesystem Helper Tools

- `write_output`: writes markdown or json under `~/outputs` with date-prefixed collision-safe names (`YYYYMMDDHHMMSS-name.md`, `YYYYMMDDHHMMSS-name-1.md`, `YYYYMMDDHHMMSS-name.json`, ...). Use `format: "markdown" | "json"` (default `markdown`). Returns the unique path where the file was written — always print it since the path is not predictable.
- `grep`: runs `rg --json` and returns `file:line:content` rows with output-size guards.
- `find`: runs `fd --glob --hidden`, respects ignore rules, and excludes `.git` and `node_modules`.
- `ls`: runs `ls -1apL`, sorts output alphabetically, and applies entry/size truncation.

## Read Tool Notes

- `read` accepts relative and absolute paths.
- `read_json` accepts a `path` and parses the full file text as JSON.
- Text output supports `offset` (1-indexed line start) and `limit` (line count) for pagination.
- Text output is truncated to `2000` lines or `50KB` (whichever is hit first), with continuation hints.
- When `read` is invoked from `run_python`, text is returned unbounded for the selected `offset`/`limit` range.
- Supported image files (`jpg`, `png`, `gif`, `webp`) are returned as image content blocks.

## Exec Output Size Notes

- `stdout` and `stderr` are tail-truncated independently to `8000` chars before they are combined.
- Truncation notices include stream and dropped char count, for example:
  - `... (12,345 chars truncated from stdout)`
- Tool-level truncation applies an additional `8000`-char tail-biased safety limit per text block before inference context storage.

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
