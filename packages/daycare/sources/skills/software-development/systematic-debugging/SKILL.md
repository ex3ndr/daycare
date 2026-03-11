---
name: systematic-debugging
description: Debug by reproducing, isolating, and proving root cause before changing code. Use for test failures, runtime bugs, flaky behavior, and broken integrations.
---

# Systematic Debugging

Do not stack guesses. Find the cause first.

## Rule

No fix without a root-cause hypothesis you can explain from evidence.

## Workflow

### 1. Reproduce

- Run the failing test, command, or workflow exactly
- Capture the full error, stack trace, and inputs
- If it is flaky, identify what changes across runs

### 2. Isolate

- Identify the first bad value, wrong branch, or missing side effect
- Trace backwards to where it was introduced
- Reduce the problem to the smallest failing case

### 3. Compare

- Find a nearby working path in the codebase
- Diff the broken and working flows
- Check recent commits, config, schema, and environment changes

### 4. Hypothesize

State one specific explanation:

```text
I think X is happening because Y, which causes Z.
```

### 5. Test minimally

- Make one small change that validates the hypothesis
- Re-run the narrowest reproduction first
- Only expand once the narrow case proves the cause

## Useful Tools

- `read` and code search for local inspection
- `exec` for reproductions and focused scripts
- `web_fetch` or docs only when behavior depends on external systems

## Anti-Patterns

- "Quick fix" before reproduction
- Changing multiple things at once
- Adding retries or guards without understanding the bad input
- Declaring success after one lucky run
