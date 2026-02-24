# Daycare Runtime Image

## Summary

Added `packages/daycare-runtime` as a Daycare-adapted runtime image based on `openai/codex-universal`.

Key adjustments:
- renamed setup contract from `CODEX_ENV_*` to `DAYCARE_ENV_*`
- renamed setup script path to `/opt/daycare/setup_daycare.sh`
- added a bun-compiled `srt` binary at `/usr/local/bin/srt` with seccomp vendor assets in `/usr/local/lib/srt/vendor`
- changed container entrypoint to `sleep infinity`

## Runtime Layout

```mermaid
flowchart TD
    A[Docker build] --> B[Install base apt packages]
    B --> C[Install language toolchains]
    C --> C1[Python via pyenv]
    C --> C2[Node 18/20/22/24 via nvm]
    B --> S1[Build srt with bun --compile]
    S1 --> S2[/usr/local/bin/srt symlink]
    S1 --> S3[/usr/local/lib/srt/vendor/seccomp]
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
