# daycare-runtime

`daycare-runtime` is a Daycare-adapted runtime image based on [`openai/codex-universal`](https://github.com/openai/codex-universal).

It provides a multi-language development container with pinned toolchains (Python, Node.js, Rust, Go, Swift, Ruby, PHP, Java, Bun, Bazel, Elixir/Erlang) and a Daycare-specific setup contract via `DAYCARE_ENV_*` variables.

## What Changed from codex-universal

- naming switched from `codex` to `daycare`
- runtime selector variables use `DAYCARE_ENV_*`
- Node setup installs global `@anthropic-ai/sandbox-runtime`
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
    -e DAYCARE_ENV_RUST_VERSION=1.92.0 \
    -e DAYCARE_ENV_GO_VERSION=1.25.1 \
    -e DAYCARE_ENV_SWIFT_VERSION=6.2 \
    -e DAYCARE_ENV_RUBY_VERSION=3.4.4 \
    -e DAYCARE_ENV_PHP_VERSION=8.5 \
    -e DAYCARE_ENV_JAVA_VERSION=25 \
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
| `DAYCARE_ENV_PYTHON_VERSION` | Python version to activate | `3.10`, `3.11`, `3.12`, `3.13`, `3.14` |
| `DAYCARE_ENV_NODE_VERSION` | Node.js version to activate | `18`, `20`, `22`, `24` |
| `DAYCARE_ENV_RUST_VERSION` | Rust version to activate | `1.83.0`, `1.84.1`, `1.85.1`, `1.86.0`, `1.87.0`, `1.88.0`, `1.89.0`, `1.90.0`, `1.91.1`, `1.92.0` |
| `DAYCARE_ENV_GO_VERSION` | Go version to activate | `1.22.12`, `1.23.8`, `1.24.3`, `1.25.1` |
| `DAYCARE_ENV_SWIFT_VERSION` | Swift version to activate | `5.10`, `6.1`, `6.2` |
| `DAYCARE_ENV_RUBY_VERSION` | Ruby version to activate | `3.2.3`, `3.3.8`, `3.4.4` |
| `DAYCARE_ENV_PHP_VERSION` | PHP version to activate | `8.2`, `8.3`, `8.4`, `8.5` |
| `DAYCARE_ENV_JAVA_VERSION` | Java version to activate | `11`, `17`, `21`, `22`, `23`, `24`, `25` |

See `packages/daycare-runtime/Dockerfile` for the full package list and exact pinned versions.
