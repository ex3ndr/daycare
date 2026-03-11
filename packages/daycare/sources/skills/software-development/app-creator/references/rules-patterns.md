# App Rules Patterns

Use this reference when writing `## Rules` sections in `PERMISSIONS.md`.

## Rule writing checklist

- Keep one constraint per rule line.
- Use concrete nouns and verbs.
- Prefer explicit path and host constraints.
- State prohibited destructive operations directly.
- Avoid broad, ambiguous phrases.

## Good allow examples

- Allow reading files under workspace root.
- Allow running `git status`, `git diff`, and `git show`.
- Allow writing only under `workspace/apps/<app-id>/data/`.

## Good deny examples

- Deny deleting files.
- Deny changing git history (`git reset`, `git rebase`, forced pushes).
- Deny writes outside `data/`.
- Deny network access except approved hosts.

## Anti-patterns

- "Be safe."
- "Only do reasonable things."
- "Avoid dangerous commands when possible."

These are hard to evaluate consistently and should be replaced with explicit constraints.

## Reviewability heuristic

A rule is strong when a reviewer can answer "allowed or denied?" without guessing.
