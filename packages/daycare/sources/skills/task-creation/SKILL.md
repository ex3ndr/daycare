---
name: task-creation
description: Create and update robust Daycare tasks (task_create/task_update + task_trigger_add) with minimal Python orchestration, explicit parameter schemas, strict allowedDomains for every networked exec/process call, and performance-first skip() behavior. Use when users ask for cron/webhook automation, recurring checks, scheduled reports, or resilient background task workflows.
sandbox: true
permissions:
  - "@read:~/"
  - "@write:~/"
  - "@network"
---

# Task Creation

Build task workflows that are small, deterministic, and cheap to run repeatedly.

## Core Rules

1. Keep task `code` short and orchestration-focused.
2. Offload heavy or reusable logic to real scripts invoked via `exec`.
3. Use `skip()` whenever the run does not require LLM reasoning.
4. For every networked command, set explicit `allowedDomains` (never rely on defaults).
5. Make tasks idempotent: safe to run multiple times without harmful side effects.

## Tooling Model

Use these tools as the default flow:

1. `task_create` or `task_update`
2. `task_trigger_add` (cron or webhook)
3. `task_read` to verify saved code and triggers
4. `task_run` (usually `sync: true`) for a fast validation pass

## Trigger Selection

Choose trigger type by behavior:

- `cron`: strict schedule (exact minute/hour/day rules).
- `webhook`: event-driven run via HTTP callback.

If the user gives an exact time/schedule, default to `cron`.
If the user asks for periodic monitoring/check-ins, default to `cron`.

## Authoring Pattern

### 1) Define stable parameters first

When runtime inputs vary, define `parameters` on the task. Keep names simple and types explicit.

### 2) Write minimal Python orchestration

Task Python should mostly:

1. Gather a tiny input snapshot (status, counts, changed files, API health).
2. Run one or two targeted tool calls.
3. Either:
   - call `skip()` when nothing needs model judgment, or
   - print concise context for the LLM when judgment is needed.

### 3) Offload complexity via exec

If logic grows beyond simple orchestration, call a script with `exec` instead of embedding large Python in the task body.

Good candidates to offload:

- parsing/transforming structured data
- large API fetch + normalization
- file generation pipelines
- repeated business logic shared by multiple tasks

### 4) Always set `allowedDomains` for networked exec

Rules:

1. Local-only commands: set `allowedDomains: []`.
2. Network calls: list every required hostname explicitly.
3. Do not use `["*"]` unless there is a documented hard requirement.

Examples:

```python
# Local-only
res = exec(command="node ./scripts/build-digest.mjs", allowedDomains=[])
```

```python
# Networked
res = exec(
    command="curl -fsSL https://api.github.com/repos/org/repo/actions/runs?per_page=5",
    allowedDomains=["api.github.com"]
)
```

If the command touches multiple services, include all domains in one list.

### 5) Use runtime JSON helpers for structured payloads

When a command or tool returns JSON text, use runtime helpers instead of hand-rolled parsing logic:

1. `json_parse(text=...)["value"]` to convert JSON text into native Python values.
2. `json_stringify(value=..., pretty=True|False)["value"]` to serialize values safely.

Use this pattern when passing structured data between tools, printing compact summaries, or normalizing payloads before decisions.

Example:

```python
raw = exec(
    command="curl -fsSL https://api.example.com/v1/incidents",
    allowedDomains=["api.example.com"]
)
incidents = json_parse(text=raw.output)["value"]

if len(incidents) == 0:
    skip()

compact = json_stringify(value=incidents[:5], pretty=False)["value"]
print("Review these incidents and produce triage priorities:")
print(compact)
```

## Performance Pattern (Mandatory)

Use this branching model on every recurring task:

1. Compute whether action is needed.
2. If not needed: call `skip()` immediately.
3. If needed but fully mechanical: do tool work, then `skip()`.
4. If needed and requires reasoning: print only essential context and let the LLM respond.

Avoid waking the LLM for empty/no-op runs.

## Robustness Checklist

Before finishing:

1. Task code is short and readable.
2. Expensive logic is offloaded to scripts.
3. All networked `exec` calls include exact `allowedDomains`.
4. No-op path calls `skip()` early.
5. Trigger type matches user intent (cron vs webhook).
6. `task_run` validation succeeded.
7. `task_read` confirms the stored task and trigger state.

## Minimal Templates

### Mechanical monitor template

```python
status = exec(command="node ./scripts/check-system.mjs", allowedDomains=[])
if "NO_CHANGES" in status.output:
    skip()

send_agent_message(agentId="ops-reporter", text=status.output)
skip()
```

### Reasoning-required template

```python
data = exec(
    command="curl -fsSL https://api.example.com/v1/incidents",
    allowedDomains=["api.example.com"]
)
print("Review incidents and produce a short triage summary.")
print(data.output)
```
