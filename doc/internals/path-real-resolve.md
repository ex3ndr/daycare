# POSIX Path Real Resolver

Added `pathRealResolve` in `packages/daycare/sources/util/pathRealResolve.ts` to normalize user-provided paths into absolute POSIX paths using explicit `homeDir` and `workingDir`.

## Supported input forms
- absolute: `/tmp/a.txt`
- relative to working dir: `./a.txt`, `../a.txt`
- home shorthand: `~`, `~/downloads/a.txt`

```mermaid
flowchart TD
  Input[targetPath] --> Tilde{starts with ~ ?}
  Tilde -->|exact "~"| Home[return homeDir]
  Tilde -->|starts "~/..."| HomeJoin[resolve from homeDir]
  Tilde -->|no| Abs{absolute path?}
  Abs -->|yes| AbsNorm[normalize absolute path]
  Abs -->|no| WorkJoin[resolve from workingDir]
```
