---
name: scheduling
description: Schedule recurring or time-based tasks. Use for alarms, reminders, periodic reviews, automated reports, or any task that should run at specific times or intervals.
---

# Scheduling

Daycare uses unified **tasks** with optional **cron** and **webhook** triggers.

## When to Use Cron

Use cron triggers when:
- Exact timing matters (e.g., "every day at 9am")
- Tasks need precise schedule control
- One-off scheduled tasks (with `deleteAfterRun`)
- Tasks that produce artifacts in a dedicated workspace

**Task/Cron tools:** `task_create`, `task_read`, `task_update`, `task_delete`, `task_trigger_add`, `task_trigger_remove`, `task_run`

### Cron Routing

Cron triggers run through `system:cron` by default. Use `task_trigger_add` with
`type: "cron"` to attach a cron schedule after creating the task.

## When to Use Webhooks

Use webhook triggers when:
- External events should trigger execution
- You need an HTTP callback endpoint
- A third-party service should invoke the task on demand

**Webhook tools:** use `task_trigger_add`/`task_trigger_remove` with `type: "webhook"` and inspect with `task_read`/`topology`

## Examples

**Task with cron trigger:**

```
1. task_create: title="API health", code='print("check API health")' → returns taskId
2. task_trigger_add: taskId=<returned taskId>, type="cron", schedule="*/10 * * * *", timezone="UTC"
```

## Selection Examples

### Choose Cron

| User Input | Why Cron |
|------------|----------|
| "Remind me every day at 9am to check my emails" | Specific time (9am daily) |
| "Run a backup script every Sunday at midnight" | Exact schedule needed |
| "Send me a weather report every morning at 7:30" | Precise daily timing |
| "Every hour, check if the server is up" | Strict hourly repetition |
| "At 5pm on weekdays, summarize my tasks" | Complex schedule (weekdays only) |
| "Once tomorrow at noon, remind me about the meeting" | One-off scheduled task |
| "Every 15 minutes, poll the API for updates" | Precise interval timing |
| "On the 1st of each month, generate a report" | Calendar-based schedule |

### Choose Webhooks (Event-Driven)

| User Input | Why Webhook |
|------------|---------------|
| "Run this when my CI webhook fires" | External callback drives execution |
| "Trigger this from GitHub/Stripe/Slack" | Event source is a webhook sender |
| "Execute when my service posts to a URL" | HTTP-triggered task is required |
| "I need a callback endpoint for this workflow" | Webhook endpoint is explicit |

### Ambiguous Cases

| User Input | Resolution |
|------------|------------|
| "Remind me about X regularly" | Cron (regular reminders are schedule-based). |
| "Check something every day" | Cron (daily schedule). |
| "Monitor Y" | Cron unless the user explicitly wants external event triggers. |
| "Schedule Z" | Cron (scheduling implies specific timing) |

## Workflow

**For cron triggers:**
1. Create the task with `task_create`
2. Attach a cron schedule with `task_trigger_add` (type: "cron", schedule, timezone)
3. Use `task_read` or `topology` to verify triggers

**For webhook triggers:**
1. Run `topology` or `task_read` to inspect existing triggers
2. Use `task_trigger_add` with `type: "webhook"`
3. Use `task_run` to trigger immediately
4. Use `task_trigger_remove` for cleanup

## Executable Prompts

Both cron and webhook prompts support **executable prompts** — `<run_python>` blocks
that are expanded before the prompt reaches the LLM. This lets you embed dynamic data
(API responses, file contents, computed values) directly in the scheduled prompt.

### How It Works

1. Write `<run_python>...</run_python>` blocks inside your cron or webhook prompt.
2. When the task fires, the system expands each block by executing the Python code
   via the RLM runtime **before** the prompt is sent to inference.
3. Each block is replaced with its output. On failure, the block becomes
   `<exec_error>error message</exec_error>`.
4. Expansion is **single-pass** — if the output itself contains `<run_python>` tags,
   they are not re-executed.

Executable prompts run when `execute: true` is set on the scheduled message.

### Cron Example with Executable Prompt

```yaml
---
name: Daily metrics
schedule: "0 9 * * *"
---
Here are today's metrics:
<run_python>
import json
with open("/data/metrics.json") as f:
    data = json.load(f)
print(f"Active users: {data['active_users']}")
print(f"Revenue: ${data['revenue']:.2f}")
</run_python>

Summarize the metrics above and flag anything unusual.
```

When this cron fires at 9am, the `<run_python>` block executes first. The LLM then
receives a prompt with the actual metrics values already embedded:

```
Here are today's metrics:
Active users: 1234
Revenue: $56789.00

Summarize the metrics above and flag anything unusual.
```

### Webhook Example with Executable Prompt

```
<run_python>
import subprocess
result = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True)
if result.stdout.strip():
    print(f"Uncommitted changes:\n{result.stdout}")
else:
    print("Working tree is clean.")
</run_python>

Review the git status above and remind me to commit if there are uncommitted changes.
```

### Error Handling

If a `<run_python>` block fails (syntax error, runtime exception, timeout), it is
replaced with an error marker:

```
<exec_error>SyntaxError: unexpected EOF while parsing</exec_error>
```

The rest of the prompt is still sent to the LLM, which can see and report the error.

## The `skip` Tool

Both cron and webhook prompts land in an agent that has access to the **`skip`** tool.
The model should call `skip` when there is nothing useful to do for the current run.

When `skip` is called:
- The agent loop stops immediately — no further inference or tool calls.
- Any remaining tool calls in the same turn are cancelled.
- This keeps costs low and avoids unnecessary LLM output.

**When to call `skip`:**
- The cron or webhook prompt describes a condition that isn't met (e.g., "notify if
  there are errors" but executable prompt output shows no errors).
- A monitoring task finds nothing to report.

**Example prompt encouraging skip:**

```yaml
---
name: Error monitor
schedule: "*/15 * * * *"
---
<run_python>
with open("/var/log/app.log") as f:
    errors = [l for l in f.readlines()[-100:] if "ERROR" in l]
print(f"Recent errors: {len(errors)}")
for e in errors[:5]:
    print(e.strip())
</run_python>

If there are 0 recent errors, call the skip tool — nothing to report.
Otherwise, summarize the errors and suggest fixes.
```

## Key Differences

| Feature | Cron | Webhook |
|---------|------|------------|
| Timing | Exact (cron expression) | Event-driven (HTTP request) |
| Agent | Isolated per task | Isolated per task or explicit `agentId` |
| Memory | Task-agent context | Task-agent context |
| Workspace | Task workspace | Task workspace |
| One-off | Yes (`deleteAfterRun`) | No |
| Executable prompts | Yes | Yes |
| Best for | Time-sensitive recurring tasks | External event callbacks |
