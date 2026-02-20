import { stat } from "node:fs/promises";

/**
 * Validates that TASK.md exists and is a file.
 * Expects: taskFilePath points to the mounted prompt file for the container build.
 */
export async function factoryTaskFileEnsure(taskFilePath: string): Promise<void> {
    let taskFileStat: Awaited<ReturnType<typeof stat>>;
    try {
        taskFileStat = await stat(taskFilePath);
    } catch {
        throw new Error(`TASK.md not found at ${taskFilePath}`);
    }

    if (!taskFileStat.isFile()) {
        throw new Error(`TASK.md is not a file: ${taskFilePath}`);
    }
}
