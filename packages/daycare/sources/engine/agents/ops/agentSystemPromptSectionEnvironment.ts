import os from "node:os";

import Handlebars from "handlebars";

import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders runtime and channel environment details.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionEnvironment(context: AgentSystemPromptContext): Promise<string> {
    const descriptor = context.descriptor;
    const isForeground = descriptor?.type === "user";
    const nametag = await nametagResolve(context);
    const template = await agentPromptBundledRead("SYSTEM_ENVIRONMENT.md");
    const section = Handlebars.compile(template)({
        isForeground,
        os: `${os.type()} ${os.release()}`,
        arch: os.arch(),
        model: context.model ?? "unknown",
        provider: context.provider ?? "unknown",
        connector: isForeground ? descriptor.connector : "unknown",
        channelId: isForeground ? descriptor.channelId : "unknown",
        userId: isForeground ? descriptor.userId : "unknown",
        nametag
    });
    return section.trim();
}

/** Looks up the nametag for the current user from storage. */
async function nametagResolve(context: AgentSystemPromptContext): Promise<string | null> {
    const storage = context.agentSystem?.storage;
    if (!storage) {
        return null;
    }
    const user = await storage.users.findById(context.ctx.userId);
    return user?.nametag ?? null; // null when user record not found
}
