# OpenSandbox Exec Backend

This note documents the pluggable sandbox exec backend added for OpenSandbox.

## Scope

- `Sandbox.read()` and `Sandbox.write()` still operate on the host filesystem
- `Sandbox.exec()` now dispatches through a backend interface
- Docker remains the default backend
- OpenSandbox is selected through settings

## Execution Flow

```mermaid
flowchart TD
    A[Agent sandboxBuild] --> B[agentSandboxBackendConfigBuild]
    B --> C[Sandbox constructor]
    C --> D[sandboxExecBackendBuild]
    D --> E[DockerExecBackend or OpenSandboxExecBackend]
    E --> F[Sandbox.exec]
    F --> G[Merge env dotenv secrets]
    G --> H[Redefine HOME and XDG dirs]
    H --> I[Backend exec]
    I --> J[Docker container exec or OpenSandbox commands.run]
```

## OpenSandbox Lifecycle

```mermaid
flowchart TD
    A[OpenSandboxExecBackend.exec] --> B[opensandboxSandboxEnsure]
    B --> C[OpenSandboxSandboxes.ensure]
    C --> D{Existing sandbox for user?}
    D -->|No| E[Create sandbox with mounted volumes]
    D -->|Yes same fingerprint| F[Reuse sandbox]
    D -->|Yes changed fingerprint| G[Kill stale sandbox]
    F --> H{TTL near expiry?}
    H -->|Yes| I[Renew timeout]
    H -->|No| J[Run command]
    E --> J
    G --> E
    I --> J
```

## Settings

```json
{
    "sandbox": {
        "backend": "opensandbox"
    },
    "opensandbox": {
        "domain": "http://localhost:8080",
        "apiKey": "optional-api-key",
        "image": "ubuntu",
        "timeoutSeconds": 600
    }
}
```

Validation rules:
- unknown `sandbox.backend` values are rejected during settings parse
- `opensandbox.domain` is required when `sandbox.backend` is `"opensandbox"`
- `opensandbox.image` is required when `sandbox.backend` is `"opensandbox"`
