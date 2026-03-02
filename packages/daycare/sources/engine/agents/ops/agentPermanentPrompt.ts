import { xmlEscape } from "../../../utils/xmlEscape.js";
import type { PermanentAgentSummary } from "./agentPermanentTypes.js";

/**
 * Formats permanent agents into an XML prompt segment for the system prompt.
 * Expects: summaries include non-empty name and systemPrompt strings.
 */
export function agentPermanentPrompt(agents: PermanentAgentSummary[]): string {
    if (agents.length === 0) {
        return "";
    }

    const ordered = [...agents].sort((a, b) => {
        const nameCompare = a.name.localeCompare(b.name, "en", {
            sensitivity: "base"
        });
        if (nameCompare !== 0) {
            return nameCompare;
        }
        return a.agentId.localeCompare(b.agentId);
    });

    const lines = [
        "<permanent_agents>",
        "  <instructions>",
        "    <create>Use create_permanent_agent to add or update a permanent agent.</create>",
        "    <describe>Descriptions summarize each agent's role.</describe>",
        "    <message>Use send_agent_message with agentId to coordinate.</message>",
        "  </instructions>",
        "  <available>"
    ];

    for (const agent of ordered) {
        lines.push("    <agent>");
        lines.push(`      <id>${xmlEscape(agent.agentId)}</id>`);
        lines.push(`      <name>${xmlEscape(agent.name)}</name>`);
        lines.push(`      <description>${xmlEscape(agent.description)}</description>`);
        if (agent.workspaceDir) {
            lines.push(`      <workspace>${xmlEscape(agent.workspaceDir)}</workspace>`);
        }
        lines.push("    </agent>");
    }

    lines.push("  </available>");
    lines.push("</permanent_agents>");

    return lines.join("\n");
}
