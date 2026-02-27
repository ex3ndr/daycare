# skill_add local folder fallback

## Summary
- `skill_add` accepts either a directory path or a direct skill file path.
- The resolver probes `skill.md` case-insensitively (`skill.md`, `SKILL.md`, `sKiLl.Md`, etc.) via `sandbox.read`.
- Failures summarize probe behavior; when all variants are missing it returns a concise "tried N variants" message.

## Resolution flow
```mermaid
flowchart TD
    A[skill_add path] --> B{Path ends with skill.md or SKILL.md?}
    B -->|yes| C[Probe direct file then all case variants]
    B -->|no| D[Probe path with all case variants of skill.md]
    C --> E{Readable text file found?}
    D --> E
    E -->|yes| F[Parse frontmatter name and install]
    E -->|no| G[Throw concise validation error with variant probe summary]
```
