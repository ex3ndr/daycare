import re
from typing import Any


def section_body(title: str, text: str) -> str:
    pattern = r"^## " + re.escape(title) + r"\s*\n(?P<body>.*?)(?=^## |\Z)"
    match = re.search(pattern, text, re.MULTILINE | re.DOTALL)
    if not match:
        return ""
    return match.group("body").strip()


def labeled_items(body: str, label: str) -> list[str]:
    lines = body.splitlines()
    items: list[str] = []
    collecting = False
    for raw_line in lines:
        line = raw_line.strip()
        if not collecting and line == f"{label}:":
            collecting = True
            continue
        if collecting:
            if not line and not items:
                continue
            if line.startswith("- "):
                items.append(line[2:].strip())
                continue
            break
    return items


def checkbox_items(body: str) -> list[str]:
    return [
        line.strip()
        for line in body.splitlines()
        if re.match(r"^- \[[ xX]\] ", line.strip()) is not None
    ]


def validation_commands(text: str) -> list[str]:
    commands: list[str] = []
    for raw_line in section_body("Validation Commands", text).splitlines():
        line = raw_line.strip()
        if not line.startswith("- "):
            continue
        command = line[2:].strip()
        if command.startswith("`") and command.endswith("`") and len(command) >= 2:
            command = command[1:-1].strip()
        if command:
            commands.append(command)
    return commands


def task_entries(implementation_text: str) -> list[dict[str, Any]]:
    pattern = re.compile(
        r"^### Task (?P<number>[^:\n]+): (?P<title>[^\n]+)\n(?P<body>.*?)(?=^### |\Z)",
        re.MULTILINE | re.DOTALL,
    )
    tasks: list[dict[str, Any]] = []
    for match in pattern.finditer(implementation_text):
        body = match.group("body").strip()
        checkboxes = checkbox_items(body)
        tasks.append(
            {
                "number": match.group("number").strip(),
                "title": match.group("title").strip(),
                "body": body,
                "files": labeled_items(body, "Files"),
                "verify": labeled_items(body, "Verify"),
                "checkboxes": checkboxes,
                "complete": len(checkboxes) > 0
                and all(line.lower().startswith("- [x] ") for line in checkboxes),
                "incomplete": any(line.lower().startswith("- [ ] ") for line in checkboxes),
            }
        )
    return tasks


def first_incomplete_task(tasks: list[dict[str, Any]]) -> dict[str, Any] | None:
    for task in tasks:
        if bool(task["incomplete"]):
            return task
    return None


def find_task(tasks: list[dict[str, Any]], number: str) -> dict[str, Any] | None:
    normalized = number.strip()
    if not normalized:
        return None
    for task in tasks:
        if str(task["number"]) == normalized:
            return task
    return None


def unique_lines(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        item = value.strip()
        if not item or item in seen:
            continue
        seen.add(item)
        ordered.append(item)
    return ordered


plan_path_value = plan_path.strip()
if not plan_path_value:
    raise Exception("plan_path is required.")

task_number_value = ""
if task_number is not None:
    task_number_value = str(task_number).strip()

branch_value = ""
if default_branch is not None:
    branch_value = str(default_branch).strip()

plan_text = read(path=plan_path_value)["content"]
overview = section_body("Overview", plan_text)
context = section_body("Context", plan_text)
tasks = task_entries(section_body("Implementation Steps", plan_text))
selected_task = find_task(tasks, task_number_value) if task_number_value else first_incomplete_task(tasks)

if selected_task is None:
    if task_number_value:
        raise Exception(f"Task {task_number_value} was not found in the plan.")
    "All plan tasks are already complete."
else:
    queue_started = False
    remaining_titles: list[str] = []
    for task in tasks:
        if str(task["number"]) == str(selected_task["number"]):
            queue_started = True
        if queue_started and not bool(task["complete"]):
            remaining_titles.append(f"Task {task['number']}: {task['title']}")

    verification_steps = unique_lines(validation_commands(plan_text) + list(selected_task["verify"]))

    lines: list[str] = []
    lines.append("Execute exactly one plan task and stop after the commit.")
    lines.append("")
    lines.append("Before editing, briefly announce:")
    lines.append("- the selected task")
    lines.append("- the files you expect to touch")
    lines.append("- the verification steps you will run")
    lines.append("")
    lines.append("Execution rules:")
    lines.append("- complete every unchecked checkbox in the selected task")
    lines.append("- do not start the next task")
    lines.append("- keep changes scoped to the files listed below unless the task proves a necessary follow-up")
    lines.append("- add or update tests before validation")
    lines.append("- run every verification command listed below and fix failures before finishing")
    lines.append("- update only this task's checklist state in the plan file")
    lines.append("- commit code and plan changes together")
    lines.append("- generate one Angular-style commit message that matches the actual change")
    lines.append("- stop after the commit and report the commit hash, touched files, and verification results")
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
    lines.append("Selected task:")
    lines.append(f"Task {selected_task['number']}: {selected_task['title']}")
    lines.append(selected_task["body"])
    lines.append("")
    if len(selected_task["files"]) > 0:
        lines.append("Expected files:")
        for file_path in selected_task["files"]:
            lines.append("- " + str(file_path))
        lines.append("")
    if len(verification_steps) > 0:
        lines.append("Verification steps:")
        for step in verification_steps:
            lines.append("- " + step)
        lines.append("")
    if len(remaining_titles) > 0:
        lines.append("Remaining task queue from this point:")
        for item in remaining_titles:
            lines.append("- " + item)
    "\n".join(lines).strip()
