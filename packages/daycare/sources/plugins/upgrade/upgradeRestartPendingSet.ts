import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AgentDescriptor, MessageContext } from "@/types";

type UpgradeRestartPendingSetOptions = {
    dataDir: string;
    descriptor: AgentDescriptor;
    context: MessageContext;
    requestedAtMs: number;
    requesterPid: number;
    previousVersion?: string;
};

/**
 * Persists post-restart metadata so the next process can acknowledge restart/upgrade completion.
 * Expects: dataDir exists or can be created, and descriptor/context are command invoker payloads.
 */
export async function upgradeRestartPendingSet(options: UpgradeRestartPendingSetOptions): Promise<void> {
    await mkdir(options.dataDir, { recursive: true });
    await writeFile(
        path.join(options.dataDir, "restart-pending.json"),
        JSON.stringify({
            descriptor: options.descriptor,
            context: options.context,
            requestedAtMs: options.requestedAtMs,
            requesterPid: options.requesterPid,
            ...(options.previousVersion ? { previousVersion: options.previousVersion } : {})
        }),
        "utf8"
    );
}
