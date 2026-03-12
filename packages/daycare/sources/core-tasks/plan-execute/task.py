import re
from typing import Any


def section_body(title: str, text: str) -> str:
    pattern = r"^## " + re.escape(title) + r"\s*\n(?P<body>.*?)(?=^## |\Z)"
    match = re.search(pattern, text, re.MULTILINE | re.DOTALL)
    if not match:
        return ""
    return match.group("body").strip()


def task_entries(implementation_text: str) -> list[dict[str, Any]]:
    pattern = re.compile(
        r"^### Task (?P<number>[^:\n]+): (?P<title>[^\n]+)\n(?P<body>.*?)(?=^### |\Z)",
        re.MULTILINE | re.DOTALL,
    )
    tasks: list[dict[str, Any]] = []
    for match in pattern.finditer(implementation_text):
        body = match.group("body").strip()
        checkbox_lines = [
            line.strip()
            for line in body.splitlines()
            if re.match(r"^- \[[ xX]\] ", line.strip()) is not None
        ]
        tasks.append(
            {
                "number": match.group("number").strip(),
                "title": match.group("title").strip(),
                "body": body,
                "complete": len(checkbox_lines) > 0
                and all(line.lower().startswith("- [x] ") for line in checkbox_lines),
            }
        )
    return tasks


plan_path_value = plan_path.strip()
if not plan_path_value:
    raise Exception("plan_path is required.")

branch_value = ""
if default_branch is not None:
    branch_value = str(default_branch).strip()

plan_text = read(path=plan_path_value)["content"]
overview = section_body("Overview", plan_text)
context = section_body("Context", plan_text)
implementation_text = section_body("Implementation Steps", plan_text)
tasks = task_entries(implementation_text)
remaining_tasks = [task for task in tasks if not bool(task["complete"])]

if len(tasks) == 0:
    raise Exception("The plan does not contain any `### Task ...` sections.")

if len(remaining_tasks) == 0:
    "All plan tasks are already complete."
else:
    lines: list[str] = []
    lines.append("Execute the full Ralph loop for every remaining task in this plan.")
    lines.append("")
    lines.append("Start by validating the plan with `core:plan-verify`.")
    lines.append("Do not delegate implementation until the plan passes validation.")
    lines.append("")
    lines.append("After validation passes, work through the remaining tasks in order.")
    lines.append("For each task:")
    lines.append("- start a fresh background workflow using `core:ralph-loop`")
    lines.append("- pass `plan_path`, `default_branch`, and `task_number` to that child")
    lines.append("- give the child the plan context and remaining task list below")
    lines.append("- wait for the child to finish and capture its commit hash, changed files, and verification results")
    lines.append("- run `core:review-results` for the same task before moving to the next one")
    lines.append("- if review finds issues, fix or rerun the task before continuing")
    lines.append("")
    lines.append("Preferred worker shape:")
    lines.append("- coordinator subagent: this task (`core:plan-execute`)")
    lines.append("- implementation child: `core:ralph-loop` scoped to one task number")
    lines.append("- direct single-task fallback: `core:section-execute-commit`")
    lines.append("")
    lines.append("Stop when every task is complete, then summarize:")
    lines.append("- commits in execution order")
    lines.append("- review outcome for each task")
    lines.append("- any follow-up work that belongs in `## Post-Completion`")
    lines.append("")
    lines.append("Plan file: " + plan_path_value)
    if branch_value:
        lines.append("Default branch: " + branch_value)
    lines.append("")
    if overview:
        lines.append("Overview:")
        lines.append(overview)
        lines.append("")
    if context:
        lines.append("Context:")
        lines.append(context)
        lines.append("")
    lines.append("Remaining task queue:")
    for task in remaining_tasks:
        lines.append(f"- Task {task['number']}: {task['title']}")
    "\n".join(lines).strip()
