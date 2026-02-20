import os from "node:os";

import Handlebars from "handlebars";

import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders runtime and channel environment details.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionEnvironment(context: AgentSystemPromptContext = {}): Promise<string> {
    const descriptor = context.descriptor;
    const isForeground = descriptor?.type === "user";
    const template = await agentPromptBundledRead("SYSTEM_ENVIRONMENT.md");
    const section = Handlebars.compile(template)({
        isForeground,
        os: `${os.type()} ${os.release()}`,
        arch: os.arch(),
        model: context.model ?? "unknown",
        provider: context.provider ?? "unknown",
        connector: isForeground ? descriptor.connector : "unknown",
        channelId: isForeground ? descriptor.channelId : "unknown",
        userId: isForeground ? descriptor.userId : "unknown"
    });
    return section.trim();
}
