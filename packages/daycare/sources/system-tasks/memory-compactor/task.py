TWELVE_HOURS_MS = 12 * 60 * 60 * 1000


def has_recent_changes(documents: list[dict], cutoff: int) -> bool:
    for document in documents:
        updated_at = document.get("updatedAt")
        if isinstance(updated_at, int) and updated_at >= cutoff:
            return True
    return False


now_info = now()
now = now_info["unixTimeMs"]
cutoff = now - TWELVE_HOURS_MS

memory_tree = vault_tree(path="vault://memory")
memory_prompt = vault_tree(path="vault://system/memory")
memory_agent_prompt = vault_read(path="vault://system/memory/agent")["summary"]
memory_compactor_prompt = vault_read(path="vault://system/memory/compactor")["summary"]
memory_entries = memory_tree["entries"]
prompt_entries = memory_prompt["entries"]

if not has_recent_changes(memory_entries, cutoff) and not has_recent_changes(prompt_entries, cutoff):
    skip()
else:
    lines: list[str] = []
    lines.append("Run scheduled memory compaction now.")
    lines.append("")
    lines.append("Required workflow:")
    lines.append("- read relevant `vault://memory/*` documents before editing")
    lines.append("- organize and compress `vault://memory` without losing important facts")
    lines.append("- merge duplicates, collapse stale low-signal detail, and tighten descriptions")
    lines.append("- update `vault://system/memory/compactor` when compaction behavior should change")
    lines.append("- update `vault://system/memory/agent` when the main memory-agent prompt should change")
    lines.append("- do not edit `vault://system/memory/search`")
    lines.append("- do not touch unrelated `vault://system/*` documents")
    lines.append("")
    lines.append("Current memory-agent prompt document:")
    lines.append("```md")
    lines.append(memory_agent_prompt)
    lines.append("```")
    lines.append("")
    lines.append("Current compactor prompt document:")
    lines.append("```md")
    lines.append(memory_compactor_prompt)
    lines.append("```")
    lines.append("")
    lines.append(f"Compaction window start: {cutoff}")
    lines.append(f"Current time: {now}")
    step("\n".join(lines).strip())
    context_compact()
    skip()
