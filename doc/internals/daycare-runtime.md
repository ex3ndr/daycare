# Daycare Runtime Image

## Summary

`packages/daycare-runtime` provides two Dockerfiles:
- `Dockerfile.minimal`: base runtime with srt + Node.js toolchain
- `Dockerfile`: full runtime copied from `Dockerfile.minimal` and extended with Python/pip/uv, Rust, and Go

Both images keep `ENTRYPOINT ["sleep", "infinity"]` and use `/opt/daycare/setup_daycare.sh` for env-based setup.

## Full Image Layout

```mermaid
flowchart TD
    A[Start from Dockerfile.minimal baseline] --> B[Install base apt packages]
    B --> C[Build and copy srt binary]
    C --> D[Install Node.js via nvm]
    D --> E[Install Python + pip + uv]
    E --> F[Install Rust via rustup]
    F --> G[Install Go tarball]
    G --> H[Copy setup_daycare.sh]
    H --> I[Cleanup /home caches]
    I --> J[Final image]
```

## Read-only Home Behavior

The runtime assumes `/home` is mounted from outside and can be reset between runs.
- cache directories are routed through `/home/.cache`
- toolchain installs for Rust/Go/Node live outside `/home` so remount/reset does not remove them

```mermaid
flowchart LR
    A[/home (external mount)] --> B[cache + workspace state]
    C[/root/.cargo + /usr/local/go + /root/.nvm] --> D[installed toolchains]
    B -. resettable .-> E[new session home]
    D --> F[toolchains still available]
```
