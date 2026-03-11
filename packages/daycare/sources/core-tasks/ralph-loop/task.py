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


def validation_commands(text: str) -> list[str]:
    body = section_body("Validation Commands", text)
    commands: list[str] = []
    for raw_line in body.splitlines():
        line = raw_line.strip()
        if not line.startswith("-"):
            continue
        command = line[1:].strip()
        if command.startswith("`") and command.endswith("`") and len(command) >= 2:
            command = command[1:-1].strip()
        if command:
            commands.append(command)
    return commands


def checkbox_items(body: str) -> list[str]:
    return [
        line.strip()
        for line in body.splitlines()
        if re.match(r"^- \[[ xX]\] ", line.strip()) is not None
    ]


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
                "incomplete": any(line.lower().startswith("- [ ] ") for line in checkboxes),
            }
        )
    return tasks


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


def find_task(tasks: list[dict[str, object]], number: str) -> dict[str, object] | None:
    normalized = number.strip()
    if not normalized:
        return None
    for task in tasks:
        if str(task["number"]) == normalized:
            return task
    return None


def first_incomplete_task(tasks: list[dict[str, object]]) -> dict[str, object] | None:
    for task in tasks:
        if bool(task["incomplete"]):
            return task
    return None


plan_path_value = plan_path.strip()
if not plan_path_value:
    raise Exception("plan_path is required.")

branch_value = ""
if default_branch is not None:
    branch_value = str(default_branch).strip()

task_number_value = ""
if task_number is not None:
    task_number_value = str(task_number).strip()

plan_text = read(path=plan_path_value)
overview = section_body("Overview", plan_text)
context = section_body("Context", plan_text)
commands = validation_commands(plan_text)
tasks = task_entries(section_body("Implementation Steps", plan_text))

if len(tasks) == 0:
    raise Exception("The plan does not contain any `### Task ...` sections.")

current_task = find_task(tasks, task_number_value) if task_number_value else first_incomplete_task(tasks)

if current_task is None:
    "All plan sections are already complete."
else:
    remaining_queue: list[str] = []
    queue_started = False
    for task in tasks:
        if str(task["number"]) == str(current_task["number"]):
            queue_started = True
        if queue_started and not bool(task["complete"]):
            remaining_queue.append(f"Task {task['number']}: {task['title']}")

    verification_steps = unique_lines(commands + list(current_task["verify"]))

    if task_number_value:
        lines: list[str] = []
        lines.append("Run a focused Ralph loop for exactly one plan task.")
        lines.append("")
        lines.append("Complete every unchecked checkbox in the selected task, then stop.")
        lines.append("Do not continue to the next task in this run.")
        lines.append("")
        lines.append("Before touching code, briefly announce:")
        lines.append("- the selected task")
        lines.append("- what it accomplishes")
        lines.append("- which files or components you expect to change")
        lines.append("")
        lines.append("Execution rules:")
        lines.append("- implement every unchecked checkbox in the selected task")
        lines.append("- add or update tests for the implementation")
        lines.append("- run every verification command listed below and fix failures before finishing")
        lines.append("- after validation passes, edit the plan file and change only this task's [ ] items to [x]")
        lines.append("- commit code and plan changes together")
        lines.append("- generate one Angular-style commit message that matches the actual change")
        lines.append("- stop after the commit and report the commit hash, changed files, and verification results")
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
        lines.append(f"Task {current_task['number']}: {current_task['title']}")
        lines.append(current_task["body"])
        lines.append("")
        if len(current_task["files"]) > 0:
            lines.append("Expected files:")
            for file_path in current_task["files"]:
                lines.append("- " + str(file_path))
            lines.append("")
        if len(verification_steps) > 0:
            lines.append("Verification steps:")
            for step in verification_steps:
                lines.append("- " + step)
            lines.append("")
        if len(remaining_queue) > 0:
            lines.append("Remaining task queue from this point:")
            for item in remaining_queue:
                lines.append("- " + item)
        "\n".join(lines).strip()
    else:
        remaining_tasks = [task for task in tasks if not bool(task["complete"])]
        lines = []
        lines.append("Run the full Ralph loop for this plan until every task is complete.")
        lines.append("")
        lines.append("Start by running `core:plan-verify` against the plan.")
        lines.append("Do not delegate implementation until the plan passes validation.")
        lines.append("")
        lines.append("Once the plan is valid, start a fresh background workflow for `core:plan-execute`.")
        lines.append("That subagent should receive the plan context and remaining task list below.")
        lines.append("")
        lines.append("Delegation rules:")
        lines.append("- the delegated plan runner should execute tasks in order")
        lines.append("- each task should run in another `core:ralph-loop` with `task_number` set")
        lines.append("- run `core:review-results` after every completed task before advancing")
        lines.append("- stop only when every task is complete or a blocking review issue remains")
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
        if commands:
            lines.append("Global validation commands:")
            for command in commands:
                lines.append("- " + command)
            lines.append("")
        lines.append("Remaining task queue:")
        for task in remaining_tasks:
            lines.append(f"- Task {task['number']}: {task['title']}")
        "\n".join(lines).strip()
