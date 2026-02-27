# skill_add local folder fallback

## Summary
- `skill_add` now accepts local skill folders that contain either `skill.md` or `SKILL.md`.
- The tool still validates via `sandbox.read` and keeps the same external error message when no valid skill file exists.

## Resolution flow
```mermaid
flowchart TD
    A[skill_add path] --> B[Try path/skill.md]
    B -->|found text file| C[Parse frontmatter name]
    B -->|missing/not-dir| D[Try path/SKILL.md]
    D -->|found text file| C
    D -->|missing/not-dir| E[Throw invalid skill directory]
```
