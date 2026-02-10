# daycare-factory

## Overview

`daycare-factory` is a CLI wrapper that runs a containerized build using a task folder containing `TASK.md` and `daycare-factory.yaml`.

The host `out/` folder is bind-mounted into the container so build artifacts are produced directly on the host.
The host `~/.pi` directory is bind-mounted as read-only to provide Pi auth (`~/.pi/agent/auth.json`) to the container.

## Build flow

```mermaid
flowchart TD
  A[CLI: daycare-factory build TASK_DIR] --> B[Resolve paths: TASK.md config out]
  B --> C[Validate TASK.md exists]
  C --> D[Reset out directory unless --keep-out]
  D --> E[Read daycare-factory.yaml]
  E --> F[Remove existing container by name if enabled]
  F --> G[Create container from configured image]
  G --> H[Mount TASK.md and out plus host ~/.pi as readonly]
  H --> I[Run internal daycare-factory command inside container]
  I --> J[Internal command verifies it is running in Docker]
  J --> K[Create Pi SDK session with SessionManager.inMemory]
  K --> L[Run Pi prompt from TASK.md via createAgentSession]
  L --> M[Execute configured buildCommand]
  M --> N[Stream logs to host stdout/stderr]
  N --> O{Exit code == 0?}
  O -- Yes --> P[Optional container cleanup]
  P --> Q[Done: outputs available in host out]
  O -- No --> R[Fail build with container exit code]
```

Pi prompt/auth failures are treated as hard failures. The flow does not include
fallback behavior.

## Repo-backed E2E fixture

The e2e script uses a committed fixture folder:
`packages/daycare-factory/examples/e2e-repo-task`.

```mermaid
flowchart LR
  A[scripts/factoryE2e.sh] --> B[examples/e2e-repo-task/TASK.md]
  A --> C[examples/e2e-repo-task/daycare-factory.yaml]
  A --> D[examples/e2e-repo-task/out/]
  D --> E[Generated artifacts after run]
```

## Config contract

Required field:
- `image`: Docker image used to start the build container.
- `buildCommand`: command array executed by the in-container internal runner.

Optional fields:
- `containerName`: stable container name; defaults to `daycare-factory-<task-folder-name>`.
- `command`: command array executed in the container.
- `workingDirectory`: container working directory.
- `taskMountPath`: mount target for `TASK.md`.
- `outMountPath`: mount target for host `out/`.
- `env`: environment variables for the container process.
- `removeExistingContainer`: remove previous container with same name before run.
- `removeContainerOnExit`: remove container after run.
