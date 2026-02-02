/**
 * Formats compaction output into a reset summary message body.
 * Expects: summary is non-empty; persist contains plain strings.
 */
export function contextCompactionSummaryBuild(summary: string, persist: string[]): string {
  const cleanedSummary = summary.trim();
  const cleanedPersist = persist
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const persistLines = cleanedPersist.length > 0
    ? cleanedPersist.map((item) => `- ${item}`)
    : ["- None"];

  return [
    "Compaction Summary:",
    cleanedSummary.length > 0 ? cleanedSummary : "No summary provided.",
    "",
    "Persist:",
    ...persistLines
  ].join("\n");
}
