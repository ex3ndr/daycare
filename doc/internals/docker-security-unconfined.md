# Docker Unconfined Security Opts

Daycare now supports enabling Docker security opts for sandbox containers through `settings.json`:

```json
{
    "docker": {
        "unconfinedSecurity": true
    }
}
```

When enabled, Daycare creates sandbox containers with:

- `--security-opt seccomp=unconfined`
- `--security-opt apparmor=unconfined`

When disabled (default), Daycare leaves Docker `SecurityOpt` unset.

To keep behavior deterministic, container metadata now stores `daycare.security.profile` (`default` or `unconfined`).
If the setting changes, Daycare treats the existing container as stale and recreates it on next ensure.

```mermaid
flowchart TD
  A[settings.docker.unconfinedSecurity] --> B{true?}
  B -->|no| C[Use default docker security profile]
  B -->|yes| D[Set SecurityOpt seccomp/apparmor unconfined]
  C --> E[Label daycare.security.profile=default]
  D --> F[Label daycare.security.profile=unconfined]
  E --> G[dockerContainerEnsure stale check]
  F --> G
  G --> H{label matches expected?}
  H -->|yes| I[Reuse container]
  H -->|no| J[Stop + remove + recreate container]
```
