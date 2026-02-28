---
name: development
description: Software development workflows for multi-agent parallel work. Use when asked to develop code, fix bugs, implement features, or work on any codebase task. Covers checkout, worktree isolation, syncing with remote, and PR creation.
---

# Development Workflow

Multi-agent development workflow. Multiple agents may be working on the same repository simultaneously — always assume you are not alone.

## 1. Checkout the Repository

Clone or locate the repository in `~/develop/`. Each agent gets its own checkout to avoid conflicts with other agents.

```bash
# If no checkout exists yet, clone into a uniquely named folder
cd ~/develop
git clone <repo-url> <project>-<agent-or-task-name>

# Example
git clone git@github.com:org/repo.git repo-fix-auth
```

Multiple agents can clone into `~/develop/` at the same time — each uses a distinct folder name. Never reuse another agent's checkout folder.

If the checkout already exists (you created it earlier), reuse it.

## 2. Sync Before Any Work

Always fetch and rebase before starting work. Do this frequently — before new tasks, before committing, and before creating PRs.

```bash
git fetch origin
git rebase origin/main
```

If rebase conflicts arise, resolve them or abort and re-clone. Never force-push to `main`.

Sync again after finishing work and before pushing, to minimize merge conflicts.

## 3. Create a Worktree for Your Task

Inside your checkout, create a git worktree for the task. This isolates your branch from other agents who may also be working in the same checkout.

```bash
# From the checkout root
git worktree add .worktrees/<task-branch-name> -b <task-branch-name>
cd .worktrees/<task-branch-name>
```

Work exclusively inside the worktree directory. The `.worktrees/` folder keeps all worktrees organized under the checkout.

When done with a task, clean up:

```bash
cd ../..
git worktree remove .worktrees/<task-branch-name>
```

## 4. Develop and Commit

Work inside the worktree. Follow the project's conventions for commits, builds, and tests. Commit frequently — small, focused commits are easier to review and rebase.

## 5. Push and Create a PR

Push the worktree branch and open a PR from it. Never push directly to `main`.

```bash
# Sync before pushing
git fetch origin
git rebase origin/main

# Push
git push -u origin <task-branch-name>

# Create PR
gh pr create --title "feat: describe the change" --body "$(cat <<'EOF'
## Summary
- What changed and why

## Test plan
- [ ] Tests pass
- [ ] Manual verification
EOF
)"
```

Each task gets its own PR. If multiple agents work on related tasks, each creates a separate PR from its own worktree branch.

## Summary

```
~/develop/
└── repo-<task>/                 # per-agent checkout
    ├── .worktrees/
    │   ├── fix-auth/            # worktree for task A
    │   └── add-metrics/         # worktree for task B (different agent)
    └── (main working tree)      # avoid working here directly
```

Key rules:
- **Separate checkouts** in `~/develop/` — one per agent
- **Worktrees** in `.worktrees/` — one per task branch
- **Sync often** — `git fetch origin && git rebase origin/main` before and after work
- **Separate PRs** — one per task, pushed from the worktree branch
- **Never push to main** — always use feature branches and PRs
