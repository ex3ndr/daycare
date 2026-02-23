# Sandbox Abstraction

## Summary

A new `Sandbox` class is now the shared I/O boundary for agent tool execution.

It owns:
- secure file reads
- secure file writes
- sandbox-runtime command execution
- optional Docker-wrapped sandbox-runtime execution

Shell tools now format LLM-facing responses while delegating all I/O to `Sandbox`.

## Flow

```mermaid
graph TD
    A[Agent] --> B[ToolExecutionContext]
    B --> C[Sandbox]

    C --> D[read]
    C --> E[write]
    C --> F[exec]

    D --> G[sandboxCanRead]
    E --> H[sandboxCanWrite]
    F --> I[sandboxFilesystemPolicyBuild]
    F --> J{docker enabled}
    J -->|false| K[runInSandbox]
    J -->|true| L[dockerRunInSandbox]
    L --> M[DockerContainers]
    M --> N[docker exec srt-cli]

    C --> U[permissions]
    C --> O[workingDir]
    C --> P[homeDir]
    C --> Q[path rewrite container<->host]

    R[Shell tools: read/write/edit/exec] --> C
    S[Other tools: skill/pdf/send-file/image-generation/mermaid] --> C
    C --> T[write sandboxPath: ~/...]
```

## Notes

- `ToolExecutionContext` now carries `sandbox` as the primary I/O surface.
- `ToolExecutionContext.permissions` and `ToolExecutionContext.fileStore` were removed.
- `Agent` constructs one `Sandbox` instance and reuses it across tool calls.
- Exec no longer accepts user-provided `home`; `Sandbox` controls HOME via `homeDir`.
- When Docker runtime is enabled, `exec` runs inside a per-user long-lived container while `read`/`write` remain host-local.
- Docker path mapping is bidirectional: host paths are rewritten to `/home/<userId>` for exec, and container paths are rewritten back for read/write.
- File-producing tools now write directly into `~/downloads` via `sandbox.write()`.
