# skill_add local folder fallback

## Summary
- `skill_add` accepts either a directory path or a direct skill file path.
- The resolver probes both `skill.md` and `SKILL.md` via `sandbox.read`.
- Failures now return a detailed summary that includes each attempted path and reason.

## Resolution flow
```mermaid
flowchart TD
    A[skill_add path] --> B{Path ends with skill.md or SKILL.md?}
    B -->|yes| C[Probe file path then case-variant fallback]
    B -->|no| D[Probe path/skill.md then path/SKILL.md]
    C --> E{Readable text file found?}
    D --> E
    E -->|yes| F[Parse frontmatter name and install]
    E -->|no| G[Throw detailed validation error with attempted paths and reasons]
```
