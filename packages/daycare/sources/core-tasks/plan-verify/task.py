import re
from typing import Any


REQUIRED_SECTIONS = [
    "Overview",
    "Context",
    "Development Approach",
    "Testing Strategy",
    "Validation Commands",
    "Progress Tracking",
    "What Goes Where",
    "Implementation Steps",
    "Post-Completion",
]


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


def task_entries(implementation_text: str) -> list[dict[str, Any]]:
    pattern = re.compile(
        r"^### Task (?P<number>[^:\n]+): (?P<title>[^\n]+)\n(?P<body>.*?)(?=^### |\Z)",
        re.MULTILINE | re.DOTALL,
    )
    tasks: list[dict[str, Any]] = []
    for match in pattern.finditer(implementation_text):
        body = match.group("body").strip()
        tasks.append(
            {
                "number": match.group("number").strip(),
                "title": match.group("title").strip(),
                "body": body,
                "files": labeled_items(body, "Files"),
                "verify": labeled_items(body, "Verify"),
                "checkboxes": checkbox_items(body),
            }
        )
    return tasks


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


def plan_title(text: str) -> str:
    match = re.search(r"^# (?P<title>[^\n]+)", text, re.MULTILINE)
    if not match:
        return ""
    return match.group("title").strip()


plan_path_value = plan_path.strip()
if not plan_path_value:
    raise Exception("plan_path is required.")

plan_text = read(path=plan_path_value)["content"]
issues: list[str] = []

title = plan_title(plan_text)
if not title:
    issues.append("Missing top-level `# Title` heading.")

for section_title in REQUIRED_SECTIONS:
    body = section_body(section_title, plan_text)
    if not body:
        issues.append(f"Missing or empty `## {section_title}` section.")

commands = validation_commands(plan_text)
if len(commands) == 0:
    issues.append("`## Validation Commands` must list at least one bullet command.")

implementation_text = section_body("Implementation Steps", plan_text)
tasks = task_entries(implementation_text)
if len(tasks) == 0:
    issues.append("`## Implementation Steps` must contain at least one `### Task ...` section.")

for task in tasks:
    display = f"Task {task['number']}: {task['title']}"
    if len(task["files"]) == 0:
        issues.append(f"{display} is missing a `Files:` block with bullet items.")
    if len(task["verify"]) == 0:
        issues.append(f"{display} is missing a `Verify:` block with bullet items.")
    if len(task["checkboxes"]) == 0:
        issues.append(f"{display} must include one or more checkbox items.")

post_completion = section_body("Post-Completion", plan_text)
if re.search(r"^- \[[ xX]\] ", post_completion, re.MULTILINE):
    issues.append("`## Post-Completion` must not contain checkboxes.")

if issues:
    lines: list[str] = []
    lines.append("Plan format is invalid for the Ralph loop.")
    lines.append("")
    lines.append("Issues:")
    for issue in issues:
        lines.append("- " + issue)
    lines.append("")
    lines.append("Expected structure:")
    lines.append("# Title")
    for section_title in REQUIRED_SECTIONS:
        lines.append(f"## {section_title}")
    lines.append("")
    lines.append("Each task under `## Implementation Steps` must look like:")
    lines.append("### Task N: Short title")
    lines.append("Files:")
    lines.append("- `path/to/file.ts`")
    lines.append("")
    lines.append("Verify:")
    lines.append("- `yarn test path/to/file.spec.ts`")
    lines.append("")
    lines.append("- [ ] implement the change")
    lines.append("- [ ] add or update tests")
    "\n".join(lines).strip()
else:
    lines = []
    lines.append("Plan format is valid for the Ralph loop.")
    lines.append("")
    lines.append("Plan file: " + plan_path_value)
    lines.append("Title: " + title)
    lines.append("")
    lines.append("Tasks:")
    for task in tasks:
        lines.append(f"- Task {task['number']}: {task['title']}")
    lines.append("")
    lines.append("Validation commands:")
    for command in commands:
        lines.append("- " + command)
    "\n".join(lines).strip()
