# daycare-runtime

`daycare-runtime` is a Daycare-adapted runtime image based on [`openai/codex-universal`](https://github.com/openai/codex-universal).

The full image now tracks the minimal image baseline and adds:
- Python + pip + uv
- Rust (rustup)
- Go

## What Changed from codex-universal

- naming switched from `codex` to `daycare`
- runtime selector variables use `DAYCARE_ENV_*`
- sandbox runtime is a bun-compiled `srt` binary at `/usr/local/bin/srt` with vendored seccomp assets under `/usr/local/lib/srt/vendor`
- container entrypoint is `sleep infinity`

## Build

```sh
docker build -t daycare-runtime:latest -f packages/daycare-runtime/Dockerfile packages/daycare-runtime
```

## Run

```sh
docker run --rm -it \
    -e DAYCARE_ENV_PYTHON_VERSION=3.12 \
    -e DAYCARE_ENV_NODE_VERSION=22 \
    -e DAYCARE_ENV_RUST_VERSION=stable \
    -e DAYCARE_ENV_GO_VERSION=1.25.1 \
    daycare-runtime:latest
```

Because the image entrypoint is `sleep infinity`, start an interactive shell explicitly when needed:

```sh
docker exec -it <container-id> bash --login
```

If you want to apply env-based runtime switching manually inside the container:

```sh
/opt/daycare/setup_daycare.sh
```

## Runtime Selectors

| Environment variable | Description | Supported versions |
| --- | --- | --- |
| `DAYCARE_ENV_PYTHON_VERSION` | Python version hint for setup script | System Python in image (`3.12.x` on Ubuntu 24.04) |
| `DAYCARE_ENV_NODE_VERSION` | Node.js version hint for setup script | `22` (installed via nvm) |
| `DAYCARE_ENV_RUST_VERSION` | Rust toolchain version hint for setup script | `stable` (installed via rustup) |
| `DAYCARE_ENV_GO_VERSION` | Go version hint for setup script | `1.25.1` (installed in image) |

The runtime assumes only `/home` is writable. Runtime setup does not mutate toolchain installations in read-only paths.

See `packages/daycare-runtime/Dockerfile` for the full package list and exact pinned versions.
