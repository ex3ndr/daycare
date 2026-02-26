import type { RlmStepResumeOptions } from "./rlmStepToolCall.js";
import type { RlmVmProgress } from "./rlmVmProgress.js";
import { rlmWorkersSharedGet } from "./rlmWorkers.js";

/**
 * Resumes Monty execution from a serialized snapshot.
 * Expects: snapshotDump was captured from the paused VM immediately before resume.
 */
export async function rlmStepResume(
    workerKey: string,
    snapshotDump: Uint8Array,
    options: RlmStepResumeOptions,
    printCallback: (...values: unknown[]) => void
): Promise<RlmVmProgress> {
    const resumed = await rlmWorkersSharedGet().resume(workerKey, {
        snapshot: Buffer.from(snapshotDump).toString("base64"),
        options
    });
    for (const line of resumed.printOutput) {
        printCallback(line);
    }
    return resumed.progress;
}
