# Daycare Runtime Image

## Summary

Added `packages/daycare-runtime` as a Daycare-adapted runtime image based on `openai/codex-universal`.

Key adjustments:
- renamed setup contract from `CODEX_ENV_*` to `DAYCARE_ENV_*`
- renamed setup script path to `/opt/daycare/setup_daycare.sh`
- installed global Node tool `@anthropic-ai/sandbox-runtime`
- changed container entrypoint to `sleep infinity`

## Runtime Layout

```mermaid
flowchart TD
    A[Docker build] --> B[Install base apt packages]
    B --> C[Install language toolchains]
    C --> C1[Python via pyenv]
    C --> C2[Node 18/20/22/24 via nvm]
    C2 --> C3[Global @anthropic-ai/sandbox-runtime]
    C --> C4[Rust via rustup]
    C --> C5[Go via mise]
    C --> C6[Swift/Ruby/PHP/Java]
    C --> D[Copy /opt/daycare/setup_daycare.sh]
    D --> E[Run verify.sh during build]
    E --> F[Final image]
    F --> G[ENTRYPOINT sleep infinity]
```

## Setup Contract

`/opt/daycare/setup_daycare.sh` reads these variables:
- `DAYCARE_ENV_PYTHON_VERSION`
- `DAYCARE_ENV_NODE_VERSION`
- `DAYCARE_ENV_RUST_VERSION`
- `DAYCARE_ENV_GO_VERSION`
- `DAYCARE_ENV_SWIFT_VERSION`
- `DAYCARE_ENV_RUBY_VERSION`
- `DAYCARE_ENV_PHP_VERSION`
- `DAYCARE_ENV_JAVA_VERSION`

When set, each variable switches the active runtime to that installed version.
