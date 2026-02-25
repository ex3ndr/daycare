import type { HeartbeatDefinition } from "../heartbeatTypes.js";

/**
 * Builds a prompt for running heartbeat tasks as a batch.
 *
 * Expects: array of HeartbeatDefinition tasks.
 * Returns: { title, prompt } for the batch.
 */
export function heartbeatPromptBuildBatch(tasks: HeartbeatDefinition[]): { title: string; prompt: string } {
    const sorted = [...tasks].sort((a, b) => {
        const titleCompare = a.title.localeCompare(b.title);
        return titleCompare !== 0 ? titleCompare : a.id.localeCompare(b.id);
    });
    if (sorted.length === 1) {
        return {
            title: `Heartbeat: ${sorted[0]!.title}`,
            prompt: `<run_python>\n${sorted[0]!.prompt}\n</run_python>`
        };
    }
    const title = `Heartbeat batch (${sorted.length})`;
    const sections = sorted.map((task, index) => {
        const heading = `## ${index + 1}. ${task.title}`;
        const idLine = `id: ${task.id}`;
        const body = `<run_python>\n${task.prompt.trim()}\n</run_python>`;
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
