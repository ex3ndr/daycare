# Secrets Engine

## Summary

This change adds user-scoped secret storage and execution-time secret injection:

- New core tools: `secret_add`, `secret_remove`
- New exec parameter: `secrets: string[]`
- Topology now includes secret metadata (without values)
- Secrets persisted in `<usersDir>/<encodeURIComponent(userId)>/secrets.json`

## Flow

```mermaid
flowchart TD
    A[secret_add tool] --> B[Secrets.add(ctx, secret)]
    B --> C[secretSave(usersDir, ctx, secrets)]
    C --> D[users/<encodedUserId>/secrets.json]

    E[secret_remove tool] --> F[Secrets.remove(ctx, name)]
    F --> C

    G[exec tool with secrets[]] --> H[Secrets.resolve(ctx, names)]
    H --> I[resolved secret env map]
    I --> J[Sandbox.exec env merge]
    J --> K[process.env -> dotenv -> env -> secrets]

    L[topology tool] --> M[Secrets.list(ctx for visible users)]
    M --> N[secret metadata only]
```

## Notes

- Secret values are not returned by tool responses or topology.
- `Secrets.resolve(...)` throws on unknown secret names.
- When multiple secret names provide the same env var, later names win.
