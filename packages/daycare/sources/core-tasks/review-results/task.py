import re


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


def task_entries(implementation_text: str) -> list[dict[str, object]]:
    pattern = re.compile(
        r"^### Task (?P<number>[^:\n]+): (?P<title>[^\n]+)\n(?P<body>.*?)(?=^### |\Z)",
        re.MULTILINE | re.DOTALL,
    )
    tasks: list[dict[str, object]] = []
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
                "complete": len(checkboxes) > 0
                and all(line.lower().startswith("- [x] ") for line in checkboxes),
            }
        )
    return tasks


def find_task(tasks: list[dict[str, object]], number: str) -> dict[str, object] | None:
    normalized = number.strip()
    if not normalized:
        return None
    for task in tasks:
        if str(task["number"]) == normalized:
            return task
    return None


def last_completed_task(tasks: list[dict[str, object]]) -> dict[str, object] | None:
    completed = [task for task in tasks if bool(task["complete"])]
    if len(completed) == 0:
        return None
    return completed[-1]


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

plan_text = read(path=plan_path_value)
overview = section_body("Overview", plan_text)
context = section_body("Context", plan_text)
tasks = task_entries(section_body("Implementation Steps", plan_text))
selected_task = find_task(tasks, task_number_value) if task_number_value else last_completed_task(tasks)

if selected_task is None:
    if task_number_value:
        raise Exception(f"Task {task_number_value} was not found in the plan.")
    raise Exception("No completed task was found to review.")

review_steps = unique_lines(validation_commands(plan_text) + list(selected_task["verify"]))

lines: list[str] = []
lines.append("Review the latest result for this plan task with a strict code-review mindset.")
lines.append("")
lines.append("Primary output requirements:")
lines.append("- findings first, ordered by severity")
lines.append("- include concrete file and line references when possible")
lines.append("- focus on bugs, regressions, missing tests, and plan mismatches")
lines.append("- if there are no findings, say that explicitly and note residual risk")
lines.append("")
lines.append("Review checklist:")
lines.append("- confirm the latest diff or commit actually satisfies the selected task")
lines.append("- verify the touched files match the promised file list, or explain why extra files were required")
lines.append("- verify the plan checklist state matches the implementation")
lines.append("- check that the required validation steps were run or should be rerun")
lines.append("- flag missing tests, weak assertions, unsafe edits, or incomplete follow-through")
lines.append("")
lines.append("Plan file: " + plan_path_value)
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
    lines.append("Promised files:")
    for file_path in selected_task["files"]:
        lines.append("- " + str(file_path))
    lines.append("")
if len(review_steps) > 0:
    lines.append("Validation to confirm during review:")
    for step in review_steps:
        lines.append("- " + step)
"\n".join(lines).strip()
