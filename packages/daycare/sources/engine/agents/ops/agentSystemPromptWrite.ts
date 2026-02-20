import { promises as fs } from "node:fs";
import path from "node:path";

import type { Config } from "@/types";
import { atomicWrite } from "../../../util/atomicWrite.js";
import { agentPath } from "./agentPath.js";

const systemPromptCache = new Map<string, string>();

/**
 * Writes the latest system prompt snapshot next to the session history.
 * Expects: sessionId matches an agent folder; prompt is fully rendered.
 */
export async function agentSystemPromptWrite(config: Config, sessionId: string, prompt: string): Promise<boolean> {
    if (systemPromptCache.get(sessionId) === prompt) {
        return false;
    }

    const basePath = agentPath(config, sessionId);
    await fs.mkdir(basePath, { recursive: true });
    const filePath = path.join(basePath, "SYSTEM.md");
    const payload = prompt.endsWith("\n") ? prompt : `${prompt}\n`;
    await atomicWrite(filePath, payload);
    systemPromptCache.set(sessionId, prompt);
    return true;
}
