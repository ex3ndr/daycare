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
    const profile = await profileResolve(context);
    const template = await agentPromptBundledRead("SYSTEM_ENVIRONMENT.md");
    const dockerEnabled = context.agentSystem?.config?.current?.docker?.enabled ?? false;
    const section = Handlebars.compile(template)({
        isForeground,
        os: `${os.type()} ${os.release()}`,
        arch: os.arch(),
        docker: dockerEnabled,
        model: context.model ?? "unknown",
        provider: context.provider ?? "unknown",
        connector: isForeground ? descriptor.connector : "unknown",
        channelId: isForeground ? descriptor.channelId : "unknown",
        userId: isForeground ? descriptor.userId : "unknown",
        nametag: profile?.nametag ?? null,
        firstName: profile?.firstName ?? null,
        lastName: profile?.lastName ?? null,
        country: profile?.country ?? null
    });
    return section.trim();
}

/** Looks up structured user profile fields from storage. */
async function profileResolve(context: AgentSystemPromptContext): Promise<{
    nametag: string;
    firstName: string | null;
    lastName: string | null;
    country: string | null;
} | null> {
    const storage = context.agentSystem?.storage;
    if (!storage) {
        return null;
    }
    const user = await storage.users.findById(context.ctx.userId);
    if (!user) {
        return null;
    }
    return {
        nametag: user.nametag,
        firstName: user.firstName,
        lastName: user.lastName,
        country: user.country
    };
}
