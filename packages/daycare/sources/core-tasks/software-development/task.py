request_text = user_prompt.strip()
if not request_text:
    raise Exception("user_prompt is required.")

plan_path_value = ""
if plan_path is not None:
    plan_path_value = str(plan_path).strip()

branch_value = ""
if default_branch is not None:
    branch_value = str(default_branch).strip()

lines: list[str] = []
lines.append("Use the built-in software development workflow for this request.")
lines.append("")
lines.append("Phase 1: Create or update the plan.")
if plan_path_value:
    lines.append("- use the provided plan path")
else:
    lines.append("- create a new plan under `docs/plans/` using `YYYYMMDD-<task-name>.md`")
lines.append("- follow the Ralph plan format exactly")
lines.append("- include `## Overview`, `## Context`, `## Development Approach`, `## Testing Strategy`, `## Validation Commands`, `## Progress Tracking`, `## What Goes Where`, `## Implementation Steps`, and `## Post-Completion`")
lines.append("- under `## Implementation Steps`, make every `### Task ...` section include `Files:`, `Verify:`, and checkbox items")
lines.append("")
lines.append("Phase 2: Validate the plan before coding.")
lines.append("- run `core:plan-verify` with the plan path")
lines.append("- if validation fails, fix the plan and rerun validation")
lines.append("- do not start implementation until the plan passes")
lines.append("")
lines.append("Phase 3: Hand implementation to the Ralph loop.")
lines.append("- start a fresh background workflow using `core:ralph-loop`")
lines.append("- pass the validated plan path and the default branch if available")
lines.append("- keep implementation in separate subagents")
lines.append("- each task must validate, update only its own checklist, and create its own Angular-style commit")
lines.append("- require review between tasks before the next task starts")
lines.append("")
lines.append("Coordinator rules:")
lines.append("- stay in the foreground as the coordinator")
lines.append("- the foreground agent owns planning, validation, and final reporting")
lines.append("- subagents own implementation and per-task commits")
lines.append("- when the Ralph loop finishes, summarize the plan path, commits, and any follow-up items")
lines.append("")
if plan_path_value:
    lines.append("Plan path: " + plan_path_value)
if branch_value:
    lines.append("Default branch: " + branch_value)
if plan_path_value or branch_value:
    lines.append("")
lines.append("User request:")
lines.append(request_text)
"\n".join(lines).strip()
