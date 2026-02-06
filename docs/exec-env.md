# Exec Environment Variables

`exec` and exec gates accept an optional `env` map to inject environment variables into the
command runtime. Keys are trimmed and blank keys are ignored. Values accept strings,
numbers, or booleans and are coerced to strings before execution. The base environment
is built by merging the normalized overrides onto `process.env`.

They also accept `redefineHome: true` to remap home-related environment variables into an
isolated workspace directory (`<workingDir>/.daycare-home`). This helps package managers
and CLI tools avoid reading or writing the real user home. Internally this is forwarded
to sandbox runtime as the `home` option.

Example:
```json
{
  "command": "node scripts/check.js",
  "redefineHome": true,
  "env": {
    "NODE_ENV": "production",
    "PORT": 3000,
    "VERBOSE": true
  }
}
```

```mermaid
flowchart TD
  A[env input] --> B{object?}
  B -- no --> C[ignore]
  B -- yes --> D[trim keys + filter primitives]
  D --> E[coerce values to strings]
  E --> F[merge with process.env]
  F --> G{redefineHome?}
  G -- no --> H[execute command]
  G -- yes --> I[set HOME USERPROFILE XDG_* TMP* and language cache envs]
  I --> H
```
