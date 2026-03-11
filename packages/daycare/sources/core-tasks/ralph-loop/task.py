import re


def section_body(title: str, text: str) -> str:
    pattern = r"^## " + re.escape(title) + r"\s*\n(?P<body>.*?)(?=^## |\Z)"
    match = re.search(pattern, text, re.MULTILINE | re.DOTALL)
    if not match:
        return ""
    return match.group("body").strip()


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


plan_path_value = plan_path.strip()
if not plan_path_value:
    raise Exception("plan_path is required.")

branch_value = ""
if default_branch is not None:
    branch_value = str(default_branch).strip()

plan_text = read(path=plan_path_value)
overview = section_body("Overview", plan_text)
context = section_body("Context", plan_text)
commands = validation_commands(plan_text)

section_pattern = re.compile(
    r"^### (?P<kind>Task|Iteration) (?P<number>[^:\n]+): (?P<title>[^\n]+)\n(?P<body>.*?)(?=^### |\Z)",
    re.MULTILINE | re.DOTALL,
)
current_section = None
for match in section_pattern.finditer(plan_text):
    if re.search(r"^\s*-\s\[\s\]", match.group("body"), re.MULTILINE):
        current_section = match
        break

if current_section is None:
    "All plan sections are already complete."
else:
    lines: list[str] = []
    lines.append("Read the plan file and execute exactly one incomplete section.")
    lines.append("Complete all unchecked items in the selected section, then stop.")
    lines.append("Do not continue to the next task or iteration in this run.")
    lines.append("")
    lines.append("Before touching code, briefly announce:")
    lines.append("- which section you picked")
    lines.append("- what it accomplishes")
    lines.append("- which files or components you expect to change")
    lines.append("")
    lines.append("Execution rules:")
    lines.append("- implement every unchecked checkbox in the selected section")
    lines.append("- add or update tests for the implementation")
    if commands:
        lines.append("- run every validation command listed below and fix failures before finishing")
    else:
        lines.append("- run the relevant validation commands for the touched code before finishing")
    lines.append("- after validation passes, edit the plan file and change only this section's [ ] items to [x]")
    lines.append("- commit code and plan changes together with a feat-style message")
    lines.append("- stop after the commit")
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
        lines.append("Validation commands:")
        for command in commands:
            lines.append("- " + command)
        lines.append("")
    lines.append("Current section:")
    lines.append(
        current_section.group("kind")
        + " "
        + current_section.group("number").strip()
        + ": "
        + current_section.group("title").strip()
    )
    lines.append(current_section.group("body").strip())

    "\n".join(lines).strip()
