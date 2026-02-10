# daycare-factory

## Overview

`daycare-factory` is a CLI wrapper that runs a containerized build using a task folder containing `TASK.md` and `daycare-factory.yaml`.

The host `out/` folder is bind-mounted into the container so build artifacts are produced directly on the host.

## Build flow

```mermaid
flowchart TD
  A[CLI: daycare-factory build TASK_DIR] --> B[Resolve paths: TASK.md config out]
  B --> C[Validate TASK.md exists]
  C --> D[Reset out directory unless --keep-out]
  D --> E[Read daycare-factory.yaml]
  E --> F[Remove existing container by name if enabled]
  F --> G[Create container from configured image]
  G --> H[Mount TASK.md as read-only and out as read-write]
  H --> I[Run configured command inside container]
  I --> J[Stream logs to host stdout/stderr]
  J --> K{Exit code == 0?}
  K -- Yes --> L[Optional container cleanup]
  L --> M[Done: outputs available in host out]
  K -- No --> N[Fail build with container exit code]
```

## Config contract

Required field:
- `image`: Docker image used to start the build container.

Optional fields:
- `containerName`: stable container name; defaults to `daycare-factory-<task-folder-name>`.
- `command`: command array executed in the container.
- `workingDirectory`: container working directory.
- `taskMountPath`: mount target for `TASK.md`.
- `outMountPath`: mount target for host `out/`.
- `env`: environment variables for the container process.
- `removeExistingContainer`: remove previous container with same name before run.
- `removeContainerOnExit`: remove container after run.
