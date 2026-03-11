---
name: subagent-driven-development
description: Execute a plan through focused background agents. Use for multi-step implementation work where tasks can be isolated and reviewed one by one.
---

# Subagent-Driven Development

Use fresh workers to keep each task small, isolated, and reviewable.

## Good Fit

- You already have a plan
- Tasks are mostly independent
- You want parallel execution without context sprawl

## Core Rules

1. Do not start implementation without a task list.
2. Give each worker the exact task text; do not make workers rediscover the plan.
3. Do not run two workers on the same files at the same time.
4. Review every completed task before declaring it done.

## Workflow

### 1. Prepare the task list

Break the work into 2-5 minute units with:

- objective
- exact files to touch
- verification command
- completion criteria

### 2. Dispatch one worker per independent task

Use `start_background_agent` for tasks that can proceed independently.

Each worker prompt should include:

- the task objective
- exact files
- repo conventions that matter
- required tests or commands
- instructions to stop and report if scope expands

### 3. Monitor and unblock

- Use `topology` to see which agents are active.
- Use `send_agent_message(..., steering=true)` if a worker is going down the wrong path.
- Use `agent_ask` when you need a direct answer from a worker.

### 4. Review before merging the task

After each worker completes:

1. Check spec compliance against the plan
2. Run a code review using the `code-review` skill
3. Fix issues before taking the next dependent task

## Anti-Patterns

- Parallelizing overlapping file edits
- Letting a worker "figure out the task" from broad context
- Skipping review because the task looked small
- Moving to the next task with open correctness concerns
