# daycare-factory

`daycare-factory` runs a build task inside Docker by mounting:
- task files (`TASK.md` and `AGENTS.md`) from a task folder (read-only)
- environment template folder from an environment folder (read-only)
- `out/` from the task folder (read-write)
- host `~/.pi` auth directory into container `/root/.pi` (read-only)

The container image and runtime options come from environment `daycare-factory.yaml`.

Inside the container, `daycare-factory` uses `@mariozechner/pi-coding-agent`
programmatic SDK (`createAgentSession`) with `SessionManager.inMemory()`.

## Task and Environment Layout

```text
task-folder/
  TASK.md
  AGENTS.md
  out/

environment-folder/
  daycare-factory.yaml
  template/
```

`out/` is deleted and recreated before each run unless `--keep-out` is provided.
Before running `buildCommand`, the internal runner copies `TASK.md` and
`AGENTS.md` into `out/` with the same filenames, and copies all files from
`environment-folder/template/` into `out/`.

## Config file

Create `daycare-factory.yaml` in the environment folder:

```yaml
image: daycare/factory:latest
buildCommand:
  - sh
  - -lc
  - |
    set -eu
    test -f "$DAYCARE_FACTORY_OUT/TASK.md"
    test -f "$DAYCARE_FACTORY_OUT/AGENTS.md"
    echo "build complete" > "$DAYCARE_FACTORY_OUT/result.txt"
testCommand:
  - sh
  - -lc
  - |
    set -eu
    test -f "$DAYCARE_FACTORY_OUT/result.txt"
testMaxAttempts: 5
containerName: daycare-factory-build
workingDirectory: /workspace
taskMountPath: /workspace/TASK.md
templateMountPath: /workspace/template
outMountPath: /workspace/out
removeExistingContainer: true
removeContainerOnExit: true
env:
  DAYCARE_FACTORY_MODE: docker
```

Required fields:
- `image`
- `buildCommand` (array command executed inside Docker after Pi task run)

Optional fields:
- `testCommand` (array command executed after `buildCommand` to validate outputs)
- `testMaxAttempts` (max build+test correction attempts when `testCommand` fails; default `5`)
- `containerName`
- `command`
- `workingDirectory`
- `taskMountPath`
- `templateMountPath`
- `outMountPath`
- `removeExistingContainer`
- `removeContainerOnExit`
- `env`

## CLI

```bash
# Build from a task directory
node dist/main.js build ./task-folder --environment ./environment-folder

# Same with custom paths/options
node dist/main.js build ./task-folder \
  --environment ./environment-folder \
  --config daycare-factory.yaml \
  --out out \
  --container-name my-factory-build \
  --keep-out
```

## Development

```bash
yarn workspace daycare-factory install
yarn workspace daycare-factory build
yarn workspace daycare-factory test
yarn workspace daycare-factory run e2e
```

The e2e command runs two committed sample tasks/environments:
- `packages/daycare-factory/examples/tasks/bash`
- `packages/daycare-factory/examples/tasks/typescript`

## Auth requirement

`~/.pi/agent/auth.json` must exist on the host. The CLI mounts host `~/.pi` into
the container as read-only so the internal Pi SDK session can authenticate
without writing session files to disk.

If Pi authentication fails inside Docker, the build fails immediately. There is
no fallback mode.

## Build history

Each build writes structured session/command history to:
- `out/build.jsonl`

This file includes Pi session events and build/test command results for each
attempt.
