import os from "node:os";

import Handlebars from "handlebars";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders runtime and channel environment details.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionEnvironment(context: AgentSystemPromptContext): Promise<string> {
    const connector = context.config?.connectorName?.trim() ?? null;
    const isForeground = Boolean(context.config?.foreground && connector);
    const targetId = await connectorTargetResolve(context, connector);
    const targetUserId = context.ctx.userId;
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
        connector: isForeground ? connector : "unknown",
        channelId: isForeground ? targetId : "unknown",
        userId: isForeground ? targetUserId : "unknown",
        nametag: profile?.nametag ?? null,
        firstName: profile?.firstName ?? null,
        lastName: profile?.lastName ?? null,
        country: profile?.country ?? null,
        timezone: profile?.timezone ?? null
    });
    return section.trim();
}

async function connectorTargetResolve(context: AgentSystemPromptContext, connector: string | null): Promise<string> {
    if (!connector || !context.agentSystem) {
        return "unknown";
    }
    const users = context.agentSystem.storage?.users;
    if (!users) {
        return "unknown";
    }
    const user = await users.findById(context.ctx.userId);
    if (!user) {
        return "unknown";
    }
    const prefix = `${connector}:`;
    const connectorKeys = Array.isArray(user.connectorKeys) ? user.connectorKeys : [];
    const connectorKey = connectorKeys.find((entry) => entry.connectorKey.startsWith(prefix))?.connectorKey;
    if (!connectorKey) {
        return "unknown";
    }
    const targetId = connectorKey.slice(prefix.length).trim();
    return targetId || "unknown";
}

/** Looks up structured user profile fields from storage. */
async function profileResolve(context: AgentSystemPromptContext): Promise<{
    nametag: string;
    firstName: string | null;
    lastName: string | null;
    country: string | null;
    timezone: string | null;
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
        country: user.country,
        timezone: user.timezone
    };
}
