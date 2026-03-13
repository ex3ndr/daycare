TWELVE_HOURS_MS = 12 * 60 * 60 * 1000


def has_recent_changes(documents: list[dict], cutoff: int) -> bool:
    for document in documents:
        updated_at = document.get("updatedAt")
        if isinstance(updated_at, int) and updated_at >= cutoff:
            return True
    return False


now = current_time_ms
cutoff = now - TWELVE_HOURS_MS

memory_tree = document_tree(path="doc://memory")
memory_prompt = document_tree(path="doc://system/memory")
memory_agent_prompt = document_read(path="doc://system/memory/agent")["summary"]
memory_compactor_prompt = document_read(path="doc://system/memory/compactor")["summary"]
memory_documents = memory_tree["documents"]
prompt_documents = memory_prompt["documents"]

if not has_recent_changes(memory_documents, cutoff) and not has_recent_changes(prompt_documents, cutoff):
    skip()
else:
    lines: list[str] = []
    lines.append("Run scheduled memory compaction now.")
    lines.append("")
    lines.append("Required workflow:")
    lines.append("- read relevant `doc://memory/*` documents before editing")
    lines.append("- organize and compress `doc://memory` without losing important facts")
    lines.append("- merge duplicates, collapse stale low-signal detail, and tighten descriptions")
    lines.append("- update `doc://system/memory/compactor` when compaction behavior should change")
    lines.append("- update `doc://system/memory/agent` when the main memory-agent prompt should change")
    lines.append("- do not edit `doc://system/memory/search`")
    lines.append("- do not touch unrelated `doc://system/*` documents")
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
