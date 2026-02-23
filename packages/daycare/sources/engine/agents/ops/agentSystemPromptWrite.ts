import { promises as fs } from "node:fs";
import path from "node:path";

import type { Config, Context } from "@/types";
import { atomicWrite } from "../../../util/atomicWrite.js";
import { agentPath } from "./agentPath.js";

const systemPromptCache = new Map<string, string>();

/**
 * Writes the latest system prompt snapshot next to the session history.
 * Expects: ctx identifies the target agent folder; prompt is fully rendered.
 */
export async function agentSystemPromptWrite(config: Config, ctx: Context, prompt: string): Promise<boolean>;
export async function agentSystemPromptWrite(config: Config, agentId: string, prompt: string): Promise<boolean>;
export async function agentSystemPromptWrite(
    config: Config,
    ctxOrAgentId: Context | string,
    prompt: string
): Promise<boolean> {
    const ctx =
        typeof ctxOrAgentId === "string" ? ({ userId: "owner", agentId: ctxOrAgentId } as Context) : ctxOrAgentId;
    const sessionId = ctx.agentId;
    if (systemPromptCache.get(sessionId) === prompt) {
        return false;
    }

    const basePath = agentPath(config, ctx);
    await fs.mkdir(basePath, { recursive: true });
    const filePath = path.join(basePath, "SYSTEM.md");
    const payload = prompt.endsWith("\n") ? prompt : `${prompt}\n`;
    await atomicWrite(filePath, payload);
    systemPromptCache.set(sessionId, prompt);
    return true;
}
