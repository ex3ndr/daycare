import { stringTruncateHeadTail } from "../../../utils/stringTruncateHeadTail.js";

const AGENT_DRAFT_TEXT_MAX_CHARS = 4000;

/**
 * Builds a compact live draft transcript from the latest assistant text and tool activity.
 * Returns null when there is nothing user-facing to show.
 */
export function agentDraftTextBuild(
    responseText: string | null,
    entries: Array<{ label: string; status: "running" | "done" | "error" }>
): string | null {
    const sections: string[] = [];
    const trimmedResponseText = responseText?.trim() ?? "";
    if (trimmedResponseText.length > 0) {
        sections.push(trimmedResponseText);
    }

    const toolLines = entries.map((entry) => entryRender(entry)).filter((entry): entry is string => entry !== null);
    if (toolLines.length > 0) {
        sections.push(["Tools:", ...toolLines].join("\n"));
    }

    if (sections.length === 0) {
        return null;
    }

    return stringTruncateHeadTail(sections.join("\n\n"), AGENT_DRAFT_TEXT_MAX_CHARS, "agent draft");
}

function entryRender(entry: { label: string; status: "running" | "done" | "error" }): string | null {
    const label = entry.label.trim();
    if (!label) {
        return null;
    }
    if (entry.status === "running") {
        return `- ${label} (running)`;
    }
    if (entry.status === "error") {
        return `- ${label} (failed)`;
    }
    return `- ${label}`;
}
