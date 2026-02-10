# daycare-factory

`daycare-factory` runs a build task inside Docker by mounting:
- `TASK.md` from your task folder (read-only)
- `out/` from your task folder (read-write)
- host `~/.pi` auth directory into container `/root/.pi` (read-only)

The container image and runtime options come from `daycare-factory.yaml`.

Inside the container, `daycare-factory` uses `@mariozechner/pi-coding-agent`
programmatic SDK (`createAgentSession`) with `SessionManager.inMemory()`.

## Task folder layout

```text
task-folder/
  TASK.md
  daycare-factory.yaml
  out/
```

`out/` is deleted and recreated before each run unless `--keep-out` is provided.

## Config file

Create `daycare-factory.yaml` in the task folder:

```yaml
image: daycare/factory:latest
buildCommand:
  - sh
  - -lc
  - |
    set -eu
    cp "$DAYCARE_FACTORY_TASK" "$DAYCARE_FACTORY_OUT/TASK.md"
    echo "build complete" > "$DAYCARE_FACTORY_OUT/result.txt"
containerName: daycare-factory-build
workingDirectory: /workspace
taskMountPath: /workspace/TASK.md
outMountPath: /workspace/out
removeExistingContainer: true
removeContainerOnExit: true
env:
  DAYCARE_FACTORY_MODE: docker
```

Required fields:
- `image`
- `buildCommand` (array command executed inside Docker after Pi task run)

All other fields are optional.

## CLI

```bash
# Build from a task directory
node dist/main.js build ./task-folder

# Same with custom paths/options
node dist/main.js build ./task-folder \
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

The e2e command runs against a committed repo example task folder:
`packages/daycare-factory/examples/e2e-repo-task`.

## Auth requirement

`~/.pi/agent/auth.json` must exist on the host. The CLI mounts host `~/.pi` into
the container as read-only so the internal Pi SDK session can authenticate
without writing session files to disk.

If Pi authentication fails inside Docker, the build fails immediately. There is
no fallback mode.
