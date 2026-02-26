import type { HeartbeatRunTask } from "../heartbeatTypes.js";

/**
 * Builds batch context for running heartbeat tasks.
 *
 * Expects: array of HeartbeatRunTask tasks.
 * Returns: { title, text, code } where text is the prefix context and code is the array of Python code blocks.
 */
export function heartbeatPromptBuildBatch(tasks: HeartbeatRunTask[]): {
    title: string;
    text: string;
    code: string[];
} {
    const sorted = [...tasks].sort((a, b) => {
        const titleCompare = a.title.localeCompare(b.title);
        return titleCompare !== 0 ? titleCompare : a.id.localeCompare(b.id);
    });
    if (sorted.length === 1) {
        return {
            title: `Heartbeat: ${sorted[0]!.title}`,
            text: `Heartbeat: ${sorted[0]!.title} (id: ${sorted[0]!.id})`,
            code: [sorted[0]!.code]
        };
    }
    const title = `Heartbeat batch (${sorted.length})`;
    const sections = sorted.map((task, index) => {
        return `${index + 1}. ${task.title} (id: ${task.id})`;
    });
    const text = [`# Heartbeat run`, "", `Run all ${sorted.length} heartbeat tasks together.`, "", ...sections].join(
        "\n"
    );
    const code = sorted.map((task) => task.code);
    return { title, text, code };
}
