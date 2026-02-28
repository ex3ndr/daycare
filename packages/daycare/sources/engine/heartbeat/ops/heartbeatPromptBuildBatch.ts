import type { HeartbeatRunTask } from "../heartbeatTypes.js";

/**
 * Builds batch context for running heartbeat tasks.
 *
 * Expects: array of HeartbeatRunTask tasks.
 * Returns: { title, text, code, inputs } where text is the prefix context,
 * code is the array of Python code blocks, and inputs is the per-block input values.
 */
export function heartbeatPromptBuildBatch(tasks: HeartbeatRunTask[]): {
    title: string;
    text: string;
    code: string[];
    inputs?: Array<Record<string, unknown> | null>;
} {
    const sorted = [...tasks].sort((a, b) => {
        const titleCompare = a.title.localeCompare(b.title);
        return titleCompare !== 0 ? titleCompare : a.id.localeCompare(b.id);
    });
    if (sorted.length === 1) {
        return {
            title: `Heartbeat: ${sorted[0]!.title}`,
            text: `Heartbeat: ${sorted[0]!.title} (id: ${sorted[0]!.id})`,
            code: [sorted[0]!.code],
            inputs: heartbeatInputsBuild(sorted)
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
    return { title, text, code, inputs: heartbeatInputsBuild(sorted) };
}

/** Returns inputs array only if at least one task has inputs. */
function heartbeatInputsBuild(tasks: HeartbeatRunTask[]): Array<Record<string, unknown> | null> | undefined {
    const hasAny = tasks.some((task) => task.inputs !== undefined);
    if (!hasAny) {
        return undefined;
    }
    return tasks.map((task) => task.inputs ?? null);
}
