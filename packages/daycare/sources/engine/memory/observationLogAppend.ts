import { promises as fs } from "node:fs";
import path from "node:path";

import { format } from "date-fns";

import type { InferObservation } from "./infer/inferObservations.js";

const OBSERVATIONS_FILE = "observations.md";

/**
 * Appends observations to the observations.md log file in the given memory directory.
 * Each entry is timestamped. Skips writing if observations array is empty.
 *
 * Expects: memoryDir is an absolute path; observations contain non-empty text/context.
 */
export async function observationLogAppend(
    memoryDir: string,
    observations: InferObservation[],
    now?: number
): Promise<void> {
    if (observations.length === 0) {
        return;
    }

    const timestamp = format(new Date(now ?? Date.now()), "yyyy-MM-dd HH:mm");
    const lines: string[] = [];

    for (const observation of observations) {
        lines.push(`## ${timestamp}`);
        lines.push(`- **Text**: ${observation.text}`);
        lines.push(`- **Context**: ${observation.context}`);
        lines.push("");
    }

    await fs.mkdir(memoryDir, { recursive: true });
    await fs.appendFile(path.join(memoryDir, OBSERVATIONS_FILE), `${lines.join("\n")}\n`);
}
