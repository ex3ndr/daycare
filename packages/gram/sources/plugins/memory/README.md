# Memory plugin

## Overview
The Memory plugin records session traffic and exposes a keyword search tool for recall.
It listens to engine events for incoming and outgoing messages, then appends entries to a JSONL log.

## Files
- `plugin.ts` - wires engine events and registers the search tool.
- `engine.ts` - file-based memory store (append + prune).
- `tool.ts` - `memory_search` tool definition.

## Settings
- `basePath` (optional): override memory storage directory. Defaults to `${dataDir}/memory`.
- `maxEntries` (optional): max number of entries to keep; older entries are pruned.

## Event handling
- On `session.updated`, records user messages with text/files.
- On `session.outgoing`, records assistant responses with text/files.
- Each entry stores `sessionId`, `source`, role, text, and file references.

## Tool behavior
- Tool name: `memory_search`.
- Parameters:
  - `query` (string, required)
  - `limit` (number, optional, 1-50)
- Execution:
  - Reads the JSONL log and filters entries that contain the query (case-insensitive).
  - Returns a text list of matching entries and includes raw entries in `details.entries`.

## Storage format
- `memory.jsonl` in the configured `basePath`.
- Each line is a JSON record containing `id`, `sessionId`, `source`, `role`, `text`, `files`, and `createdAt`.
