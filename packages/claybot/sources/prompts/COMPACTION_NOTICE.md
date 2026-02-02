[compaction-warning]
Context window nearing the limit ({{estimatedTokens}} tokens approx {{percent}}% of {{emergencyLimit}}).
Warning threshold: {{warningLimit}}. Critical threshold: {{criticalLimit}}. Remaining headroom: {{remaining}}.
Severity: {{severity}}. Target after compaction: <= {{targetTokens}} tokens.

You must call the tool `compact` now. Do not answer the user until compaction is complete.
Arguments:
- summary: output from the Compaction Prompt below.
- persist: durable items to keep (paths, ids, TODOs, decisions, commands, URLs, constraints).
Include the current user request in persist if it must be resumed after compaction.

Compaction Prompt:
{{compactionPrompt}}
