import { promises as fs } from "node:fs";
import path from "node:path";

import type { Context } from "@mariozechner/pi-ai";

import type { Config, Context as DaycareContext } from "@/types";
import type { ProviderSettings } from "../../../settings.js";
import { atomicWrite } from "../../../utils/atomicWrite.js";
import { agentPath } from "./agentPath.js";

type AgentInferencePromptWriteOptions = {
    context: Context;
    sessionId: string;
    providersOverride: ProviderSettings[];
    iteration: number;
};

/**
 * Writes the latest inference request snapshot next to SYSTEM.md.
 * Expects: options.context is the exact object passed to inferenceRouter.complete().
 */
export async function agentInferencePromptWrite(
    config: Config,
    ctx: DaycareContext,
    options: AgentInferencePromptWriteOptions
): Promise<void>;
export async function agentInferencePromptWrite(
    config: Config,
    ctx: DaycareContext,
    options: AgentInferencePromptWriteOptions
): Promise<void> {
    const { context, sessionId, providersOverride, iteration } = options;
    const at = Date.now();
    const basePath = agentPath(config, ctx);
    await fs.mkdir(basePath, { recursive: true });
    const filePath = path.join(basePath, "INFERENCE.md");

    const payload = [
        "# Inference Snapshot",
        "",
        "This file is overwritten before each inference call with the exact request payload.",
        "",
        `- at: \`${new Date(at).toISOString()}\``,
        `- timestamp: \`${at}\``,
        `- iteration: \`${iteration}\``,
        `- sessionId: \`${sessionId}\``,
        `- messageCount: \`${context.messages?.length ?? 0}\``,
        `- toolCount: \`${context.tools?.length ?? 0}\``,
        `- providersOverrideCount: \`${providersOverride.length}\``,
        "",
        "## Request Context",
        "```json",
        stringifySafe(context),
        "```",
        "",
        "## Providers Override",
        "```json",
        stringifySafe(providersOverride),
        "```",
        ""
    ].join("\n");

    await atomicWrite(filePath, payload.endsWith("\n") ? payload : `${payload}\n`);
}

function stringifySafe(value: unknown): string {
    try {
        return JSON.stringify(value, null, 2);
    } catch (error) {
        return JSON.stringify(
            {
                error: "Failed to serialize value",
                detail: error instanceof Error ? error.message : String(error)
            },
            null,
            2
        );
    }
}
