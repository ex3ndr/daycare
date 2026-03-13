---
name: tasks-creator
description: Create and update robust Daycare tasks (task_create/task_update + task_trigger_add) and permanent agents (create_permanent_agent) with minimal Python orchestration, explicit parameter schemas, reproducible exec/process usage, and performance-first skip() behavior. Use when users ask for cron/webhook automation, recurring checks, scheduled reports, permanent agents, or resilient background task workflows.
tools:
  - task_create
  - task_read
  - task_update
  - task_delete
  - task_run
  - task_trigger_add
  - task_trigger_remove
  - create_permanent_agent
sandbox: true
---

# Task Creation

Build task workflows that are small, deterministic, and cheap to run repeatedly.

## Core Rules

1. **Search memory first.** Before using any tool, search memory for how the tool works and how the user expects it to be used. Understand both the mechanics and the user's intent before writing task code.
2. Keep task `code` short and orchestration-focused.
3. Offload heavy or reusable logic to real scripts invoked via `exec`.
4. Use `skip()` whenever the run does not require LLM reasoning.
5. Keep command inputs explicit and reproducible; do not hide behavior behind ad hoc shell state.
6. Make tasks idempotent: safe to run multiple times without harmful side effects.

## Tooling Model

Use these tools as the default flow:

1. `task_create` or `task_update`
2. `task_trigger_add` (cron or webhook)
3. `task_read` to verify saved code and triggers
4. `task_run` (usually `sync: true`) for a fast validation pass

## Test Before Executing

Tasks must be validated before they go live. Test incrementally to minimize side effects:

1. **Test segments in isolation first.** Before assembling the full task, run individual `exec` commands or tool calls manually to confirm they produce expected output and have no unintended effects.
2. **Run the full task with `task_run`.** Use `sync: true` on the complete task code. Review the output carefully before adding triggers.
3. **Never attach triggers to untested tasks.** Add `task_trigger_add` only after a successful `task_run` proves the code works end-to-end.
4. **Scope blast radius.** When a task touches external services, test against a single item or narrow filter before widening to the full dataset.

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

### 4) Keep network usage explicit in commands

Rules:

1. Local-only commands should still be written so they are obviously local-only.
2. Network calls should use direct, reviewable URLs and avoid hidden indirection.
3. Prefer checked-in scripts when a command grows beyond one or two simple shell operations.

Examples:

```python
# Local-only
res = exec(command="node ./scripts/build-digest.mjs")
```

```python
# Networked
res = exec(
    command="curl -fsSL https://api.github.com/repos/org/repo/actions/runs?per_page=5"
)
```

If the command touches multiple services, keep them visible in the command or script source.

### 5) Use runtime JSON helpers for structured payloads

When a command or tool returns JSON text, use runtime helpers instead of hand-rolled parsing logic:

1. `json_parse(text=...)["value"]` to convert JSON text into native Python values.
2. `json_stringify(value=..., pretty=True|False)["value"]` to serialize values safely.

Use this pattern when passing structured data between tools, printing compact summaries, or normalizing payloads before decisions.

Example:

```python
raw = exec(
    command="curl -fsSL https://api.example.com/v1/incidents"
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
3. Commands are explicit about what they access and are easy to audit.
4. No-op path calls `skip()` early.
5. Trigger type matches user intent (cron vs webhook).
6. `task_run` validation succeeded.
7. `task_read` confirms the stored task and trigger state.

## Minimal Templates

### Mechanical monitor template

```python
status = exec(command="node ./scripts/check-system.mjs")
if "NO_CHANGES" in status.output:
    skip()

send_agent_message(agentId="ops-reporter", text=status.output)
skip()
```

### Reasoning-required template

```python
data = exec(
    command="curl -fsSL https://api.example.com/v1/incidents"
)
print("Review incidents and produce a short triage summary.")
print(data.output)
```

## Patterns

### Scheduling frequency

Pick cron intervals based on cost and expected change rate:

- **Cheap checks (no LLM):** schedule every 3 minutes. If the data source updates frequently and the check is a simple `exec` + `skip()`, high frequency is fine.
- **Slow-changing data:** schedule once a day. Pick a time when the data is most likely to have changed (e.g. end of business day for reports, early morning for overnight batch results).
- **Moderate change rate:** somewhere in between — every 30 minutes to every few hours depending on how stale the data can be before it matters.

The goal is to avoid wasting runs on data that hasn't changed while keeping latency acceptable for the user.

### Recommendations and advice tasks

When a task is meant to generate recommendations, suggestions, or advice, it **must** print context and let the LLM reason. Never shortcut this with `skip()` and canned text. The whole point is genuine, thoughtful output from the model.

```python
data = exec(command="node /developer/tasks/weekly-digest/fetch-metrics.mjs")
print("Based on the following metrics, write 3 actionable recommendations for the team:")
print(data.output)
```

Always give the LLM a clear prompt with the relevant data so the advice is grounded and specific — not generic filler.

### Website parsing tasks

When a task needs to scrape or parse a website, write a dedicated parser script instead of embedding parsing logic in the task code.

1. Write the parser in Python or TypeScript.
2. Store it on disk under `/developer/tasks/<task-name>/` (e.g. `/developer/tasks/price-monitor/parse.py`).
3. Call it from the task via `exec`.

```python
res = exec(command="python3 /developer/tasks/price-monitor/parse.py")
prices = json_parse(text=res.output)["value"]

if len(prices["changes"]) == 0:
    skip()

compact = json_stringify(value=prices["changes"], pretty=False)["value"]
print("These prices changed since last check. Summarize the moves:")
print(compact)
```

This keeps the task code minimal, makes the parser independently testable, and avoids fragile inline scraping logic.

## Permanent Agents

Tasks can coordinate with **permanent agents** — background agents with stable identities. Use `create_permanent_agent` to set one up.

### What Permanent Agents Provide

1. **Stable identity** — predictable agent IDs you can reference from tasks
2. **Dedicated system prompts** — durable instructions for specialized roles
3. **Optional workspace folders** — focused file scopes inside the main workspace
4. **Reusable collaboration** — tasks can delegate work via `send_agent_message`

### Creating a Permanent Agent

Gather these inputs:
- Agent name (short, descriptive, stable)
- Short description
- System prompt (narrow and durable — role, constraints, communication style)
- Optional workspace subfolder

Then call `create_permanent_agent`. Reusing a name updates the existing agent.

### Example: Task + Permanent Agent

```
// Create a helper agent
create_permanent_agent({
  name: "Release Tracker",
  description: "Tracks release readiness and reports risks.",
  systemPrompt: "You track release status, summarize risks, and report progress.",
  workspaceDir: "release-notes"
})

// Task code that delegates to the agent
status = exec(command="node ./scripts/check-release.mjs")
if "NO_CHANGES" in status.output:
    skip()

send_agent_message(agentId="release-tracker", text=status.output)
skip()
```
