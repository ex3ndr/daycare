import Handlebars from "handlebars";
import { timezoneIsValid } from "../../../utils/timezoneIsValid.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders the preamble section from role metadata and current date.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionPreamble(_context: AgentSystemPromptContext): Promise<string> {
    const template = await agentPromptBundledRead("SYSTEM.md");
    const parentAgentId = await parentAgentIdResolve(_context);
    const timezone = await preambleTimezoneResolve(_context);
    const section = Handlebars.compile(template)({
        isForeground: _context.config?.foreground ?? false,
        parentAgentId,
        date: preambleDateResolve(Date.now(), timezone),
        timezone
    });
    return section.trim();
}

async function parentAgentIdResolve(context: AgentSystemPromptContext): Promise<string> {
    if (!context.config) {
        return "";
    }
    const kind = context.config.kind ?? "agent";
    if (kind !== "sub" && kind !== "search") {
        return "";
    }
    return context.config.parentAgentId ?? "";
}

async function preambleTimezoneResolve(context: AgentSystemPromptContext): Promise<string> {
    const profileTimezone = await profileTimezoneResolve(context);
    if (profileTimezone) {
        return profileTimezone;
    }
    const processTimezone = process.env.TZ?.trim() ?? "";
    if (processTimezone && timezoneIsValid(processTimezone)) {
        return processTimezone;
    }
    const runtimeTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim() ?? "";
    if (runtimeTimezone && timezoneIsValid(runtimeTimezone)) {
        return runtimeTimezone;
    }
    return "UTC";
}

async function profileTimezoneResolve(context: AgentSystemPromptContext): Promise<string | null> {
    const storage = context.agentSystem?.storage;
    if (!storage) {
        return null;
    }
    const user = await storage.users.findById(context.ctx.userId);
    const timezone = user?.timezone?.trim() ?? "";
    return timezone && timezoneIsValid(timezone) ? timezone : null;
}

function preambleDateResolve(nowAt: number, timezone: string): string {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });
    const parts = formatter.formatToParts(new Date(nowAt));
    const year = parts.find((part) => part.type === "year")?.value ?? "";
    const month = parts.find((part) => part.type === "month")?.value ?? "";
    const day = parts.find((part) => part.type === "day")?.value ?? "";
    return `${year}-${month}-${day}`;
}
