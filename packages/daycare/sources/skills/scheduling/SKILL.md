---
name: scheduling
description: Schedule recurring or time-based tasks. Use for alarms, reminders, periodic reviews, automated reports, or any task that should run at specific times or intervals.
---

# Scheduling

Daycare supports two scheduling mechanisms: **cron** for precise timing and **heartbeats** for periodic check-ins.

## When to Use Cron

Use cron when:
- Exact timing matters (e.g., "every day at 9am")
- Tasks need their own isolated agent and memory
- One-off scheduled tasks (with `deleteAfterRun`)
- Tasks that produce artifacts in a dedicated workspace

**Cron tools:** `cron_add`, `cron_read_task`, `cron_read_memory`, `cron_write_memory`, `cron_delete_task`

### Cron Routing

Cron tasks run in their own dedicated cron agent by default. If you want the cron
notification to land in an existing agent (e.g. a user chat), include `agentId`
in `cron_add` to route the prompt to that agent instead.

## When to Use Heartbeats

Use heartbeats when:
- Approximate timing is acceptable (~30 minute intervals)
- Tasks need ongoing context from the main agent
- Prompts evolve over time and need periodic review
- Lightweight status checks or reminders

**Heartbeat tools:** `heartbeat_add`, `heartbeat_run`, `heartbeat_remove` (use `topology` to inspect tasks)

## Examples

**Cron with routing (`TASK.md` frontmatter):**

```yaml
---
name: API health
schedule: "*/10 * * * *"
agentId: cu3ql2p5q0000x5p3g7q1l8a9
---
If the API is down, notify me with a short summary.
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

### Choose Heartbeats

| User Input | Why Heartbeat |
|------------|---------------|
| "Periodically check on my project status" | Ongoing review, flexible timing |
| "Keep an eye on my git branches" | Continuous monitoring, evolving context |
| "Remind me about my todos from time to time" | Lightweight, approximate timing |
| "Check in on code quality occasionally" | Periodic review that needs reasoning |
| "Monitor my open PRs and update me" | Ongoing task that evolves |
| "Review my notes and suggest improvements" | Needs main agent context |
| "Periodically summarize what I've been working on" | Flexible interval, ongoing |
| "Keep track of my daily progress" | Continuous, evolving check-in |

### Ambiguous Cases

| User Input | Resolution |
|------------|------------|
| "Remind me about X regularly" | Ask: need exact times? Cron. Flexible? Heartbeat. |
| "Check something every day" | Ask: specific time? Cron. Anytime during day? Heartbeat. |
| "Monitor Y" | Heartbeat (monitoring implies ongoing, evolving context) |
| "Schedule Z" | Cron (scheduling implies specific timing) |

## Workflow

**For cron tasks:**
1. Determine the schedule (cron expression: `minute hour day month weekday`)
2. Use `cron_add` with name, schedule, and prompt (optional `agentId`)
3. Each task gets isolated agent, memory file, and workspace

**For heartbeats:**
1. Run `topology` to see existing heartbeat tasks and ownership
2. Use `heartbeat_add` with title and prompt
3. Use `heartbeat_run` to trigger immediately
4. Use `heartbeat_remove` for cleanup

## Executable Prompts

Both cron and heartbeat prompts support **executable prompts** — `<run_python>` blocks
that are expanded before the prompt reaches the LLM. This lets you embed dynamic data
(API responses, file contents, computed values) directly in the scheduled prompt.

### How It Works

1. Write `<run_python>...</run_python>` blocks inside your cron or heartbeat prompt.
2. When the task fires, the system expands each block by executing the Python code
   via the RLM runtime **before** the prompt is sent to inference.
3. Each block is replaced with its output. On failure, the block becomes
   `<exec_error>error message</exec_error>`.
4. Expansion is **single-pass** — if the output itself contains `<run_python>` tags,
   they are not re-executed.

Executable prompts require the `features.rlm` flag to be enabled. When RLM is disabled,
prompts are forwarded as-is without expansion.

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

### Heartbeat Example with Executable Prompt

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

Both cron and heartbeat prompts land in an agent that has access to the **`skip`** tool.
The model should call `skip` when there is nothing useful to do for the current run.

When `skip` is called:
- The agent loop stops immediately — no further inference or tool calls.
- Any remaining tool calls in the same turn are cancelled.
- This keeps costs low and avoids unnecessary LLM output.

**When to call `skip`:**
- The cron or heartbeat prompt describes a condition that isn't met (e.g., "notify if
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

| Feature | Cron | Heartbeats |
|---------|------|------------|
| Timing | Exact (cron expression) | ~30 minute intervals |
| Agent | Isolated per task | Shared main agent |
| Memory | Persistent `MEMORY.md` | Main agent context |
| Workspace | Dedicated `files/` dir | None |
| One-off | Yes (`deleteAfterRun`) | No |
| Executable prompts | Yes | Yes |
| Best for | Time-sensitive tasks | Ongoing reviews |
