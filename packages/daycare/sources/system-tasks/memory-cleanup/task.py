import re
import time


TWELVE_HOURS_MS = 12 * 60 * 60 * 1000


def updated_times(text: str) -> list[int]:
    values: list[int] = []
    for match in re.finditer(r"\*\*updatedAt\*\*: (\d+)", text):
        values.append(int(match.group(1)))
    for match in re.finditer(r"updatedAt=(\d+)", text):
        values.append(int(match.group(1)))
    return values


def has_recent_changes(text: str, cutoff: int) -> bool:
    return any(value >= cutoff for value in updated_times(text))


now = int(time.time() * 1000)
cutoff = now - TWELVE_HOURS_MS

memory_tree = document_read(path="doc://memory")["summary"]
memory_prompt = document_read(path="doc://system/memory")["summary"]

if not has_recent_changes(memory_tree, cutoff) and not has_recent_changes(memory_prompt, cutoff):
    "No recent memory changes to organize."
else:
    lines: list[str] = []
    lines.append("Run scheduled memory maintenance now.")
    lines.append("")
    lines.append("Required workflow:")
    lines.append("- read `doc://memory` and `doc://system/memory` before editing")
    lines.append("- organize and compress `doc://memory` without losing important facts")
    lines.append("- merge duplicates, collapse stale low-signal detail, and tighten descriptions")
    lines.append("- update `doc://system/memory` when the cleanup policy should change")
    lines.append("- do not touch unrelated `doc://system/*` documents")
    lines.append("")
    lines.append(f"Cleanup window start: {cutoff}")
    lines.append(f"Current time: {now}")
    "\n".join(lines).strip()
