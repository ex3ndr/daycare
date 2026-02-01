import type { HeartbeatDefinition } from "./heartbeat-store.js";

export function heartbeatPromptBuildBatch(
  tasks: HeartbeatDefinition[]
): { title: string; prompt: string } {
  const sorted = [...tasks].sort((a, b) => {
    const titleCompare = a.title.localeCompare(b.title);
    return titleCompare !== 0 ? titleCompare : a.id.localeCompare(b.id);
  });
  if (sorted.length === 1) {
    return {
      title: `Heartbeat: ${sorted[0]!.title}`,
      prompt: sorted[0]!.prompt
    };
  }
  const title = `Heartbeat batch (${sorted.length})`;
  const sections = sorted.map((task, index) => {
    const heading = `## ${index + 1}. ${task.title}`;
    const idLine = `id: ${task.id}`;
    const body = task.prompt.trim();
    return [heading, idLine, "", body].filter(Boolean).join("\n");
  });
  const prompt = [
    "# Heartbeat run",
    "",
    `Run all ${sorted.length} heartbeat tasks together. Keep results grouped by task.`,
    "",
    ...sections
  ].join("\n");
  return { title, prompt };
}
