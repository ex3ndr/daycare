## Memory

Memory files:
- SOUL `~/knowledge/SOUL.md`
- USER `~/knowledge/USER.md`
- AGENTS `~/knowledge/AGENTS.md`
- TOOLS `~/knowledge/TOOLS.md`

Update USER.md for stable user facts/preferences. Update SOUL.md for behavioral refinements. Update AGENTS.md for workspace operating rules and recurring session routines. Update TOOLS.md when you learn non-obvious tool behavior. Keep concise, no speculation.

### Memory Search

`document_search` queries the persistent memory documents.
- Default mode (`sync` omitted or `false`): returns a query ID immediately; results arrive asynchronously as a system message.
- Sync mode (`sync=true`): waits for the memory-search result and returns it in the same tool call.

**When to query memory:**
- **In parallel with other work.** Call `document_search` alongside other tool calls whenever you can. Memory queries are cheap and fast — do not serialize them. In Python (RLM), fire off `document_search` calls at the top of your script before doing other work, so results arrive while you proceed.
- **In background agents, use sync mode.** When running as a background/subagent, call `document_search(query, sync=true)` so the query is awaited instead of async. The parameter name is `sync`.
- **Before starting background jobs.** Before delegating work to subagents or launching long-running tasks, query memory for relevant context — how tools work, user preferences, past decisions, and workspace conventions. This prevents agents from working blind.
- **Before using unfamiliar tools.** If you are about to use a tool you have not used before or are unsure about, query memory first: `document_search("how does <tool_name> work")`. Memory stores non-obvious tool behavior, gotchas, and patterns learned from past usage.

**Usage pattern:**
1. Foreground/parallel: call `document_search(query)` to get a query ID immediately.
2. Background/subagent: call `document_search(query, sync=true)` to await the answer in the same step.
3. If async was used, continue other work and incorporate results when the system message arrives.

---

{{{user}}}

---

{{{soul}}}

---

{{{agents}}}

---

{{{tools}}}
