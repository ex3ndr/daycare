---
name: app-creator
description: Guide for creating effective apps. Use when users want to create a new app or update an existing app with APP.md, PERMISSIONS.md, allow and deny rules, and sandboxed execution.
license: Complete terms in LICENSE.txt
---

# App Creator

This skill provides guidance for creating effective Daycare apps.

## About Apps

Apps are sandboxed tool wrappers discovered from
`workspace/apps/<app-id>/APP.md` and `workspace/apps/<app-id>/PERMISSIONS.md`.
Each app is exposed as a callable tool named `app_<name>`.

On invocation, an app runs as a constrained app agent and each tool call is reviewed
against the app's allow/deny rules before execution.

### What Apps Provide

1. Isolated capabilities with explicit boundaries
2. Rule-reviewed tool execution on every app tool call
3. Persistent app state in `data/`
4. Reusable app behavior via clear metadata and strict rules

## Core Principles

### Start Narrow

Default to restrictive rules and small scope. Add capabilities only when they are
required by real usage.

### Keep Rules Concrete

Write allow/deny rules in specific, testable language. Prefer concrete constraints
(paths, hosts, command families) over vague policy statements.

### Preserve Isolation

Design around Daycare app boundaries:

- App writes only to `workspace/apps/<app-id>/data/`
- App manifest and bundled files are read-only to the app
- Non-app agents should not read/write app directories

## Anatomy of an App

Every app consists of required `APP.md` and `PERMISSIONS.md` files plus optional bundled resources:

```text
app-id/
├── APP.md (required)
│   ├── YAML frontmatter (required)
│   │   ├── name: (required, username-style; this is the app id)
│   │   ├── title: (required, human-readable)
│   │   ├── description: (required)
│   │   └── model: (optional)
│   └── Markdown body (required)
│       └── ## System Prompt
├── PERMISSIONS.md (required)
│   └── Markdown body (required)
│       ├── ## Source Intent
│       └── ## Rules
│           ├── ### Allow
│           └── ### Deny
├── data/ (required runtime writable state)
└── scripts/ (optional read-only helpers)
```

### APP.md (required)

Every `APP.md` consists of:

- **Frontmatter** (YAML): `name`, `title`, `description`, optional `model`.
- **Body** (Markdown): required `## System Prompt`.

When parsing or writing `APP.md`:

- Never parse frontmatter manually
- Never write frontmatter manually
- Always use `gray-matter` for parse and stringify flows

### Example APP.md

```markdown
---
name: github-reviewer
title: GitHub Reviewer
description: Reviews pull requests and drafts feedback
model: default
---

## System Prompt

You review pull requests and provide concrete, actionable feedback.
```

### Example PERMISSIONS.md

```markdown
## Source Intent

Review pull requests and draft actionable feedback while preserving repository safety.

## Rules

### Allow
- Read files in the workspace
- Run read-only git commands

### Deny
- Write outside data/
- Delete files
- Rewrite git history
```

## App Creation Process

App creation involves these steps:

1. Understand concrete app use cases
2. Plan boundaries and reusable app resources
3. Initialize the app in workspace
4. Edit `APP.md`, `PERMISSIONS.md`, and app resources
5. Validate behavior and safety
6. Iterate based on real usage

Follow these steps in order, skipping only if there is a clear reason.

### Step 1: Understand with Concrete Examples

Collect examples that should be handled by the app and examples that should be denied
or handled elsewhere.

Capture:

- expected input/output shape
- required tool classes (`read`, `write`, `edit`, `exec`)
- safety boundaries and failure modes

### Step 2: Plan Boundaries and Resources

Before creating files, define:

- app id and scope
- success criteria
- rule matrix (allow/deny/conditional)
- persistent state model for `data/`

Consult references:

- **Workflow design**: `references/workflows.md`
- **Rule design and anti-patterns**: `references/rules-patterns.md`

### Step 3: Initialize App in Workspace

Create the app structure:

```bash
mkdir -p workspace/apps/<app-id>/data
mkdir -p workspace/apps/<app-id>/scripts
```

Then create `APP.md` and `PERMISSIONS.md` with required sections.

### Step 4: Edit APP.md, PERMISSIONS.md, and Resources

Write clear metadata in `APP.md` and clear source intent + allow/deny rules in `PERMISSIONS.md`.

If scripts are needed, keep them minimal and app-specific.

### Step 5: Validate Behavior and Safety

Validation checklist:

- Frontmatter has valid `name`, `title`, `description` (optional `model`)
- APP.md body includes a non-empty `## System Prompt`
- Tool name maps cleanly to `app_<name>`
- Writes are limited to `data/`
- Allow rules cover intended workflows
- Deny rules block destructive actions
- Error messages are actionable when calls are denied

Run tests and typecheck after changes.

### Step 6: Iterate

After real usage:

1. Capture failures and unnecessary denials
2. Tighten prompt and rules
3. Re-test representative workflows
4. Keep changes small and reversible

## Practical Guidance

### Keep Apps Single-Purpose

If one app starts owning unrelated workflows, split it into multiple apps.

### Prefer Stable Rules

Write rules that remain understandable months later and are tied to observable behavior.

### Keep Runtime Rule Changes Aligned

If rules are modified at runtime via app rule tools, keep `PERMISSIONS.md` and runtime
behavior consistent.
