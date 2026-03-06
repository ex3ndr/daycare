# Docker Readonly Default

Docker sandboxing now defaults to a read-only root filesystem when `docker.readOnly` is omitted.

```mermaid
flowchart TD
    Settings[settings.json docker.readOnly] --> Resolve[configResolve]
    Resolve --> |unset| DefaultTrue[readOnly = true]
    Resolve --> |explicit false| Writable[readOnly = false]
    Resolve --> |explicit true| Readonly[readOnly = true]

    DefaultTrue --> Sandbox[Sandbox / process containers]
    Writable --> Sandbox
    Readonly --> Sandbox
```

This only changes the default. Callers can still opt out with `docker.readOnly: false`.
