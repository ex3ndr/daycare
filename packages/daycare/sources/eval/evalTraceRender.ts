import type { AgentHistoryRecord } from "@/types";

import { messageContentExtractText } from "../engine/messages/messageContentExtractText.js";
import { messageContentExtractToolCalls } from "../engine/messages/messageContentExtractToolCalls.js";
import { stringTruncateHeadTail } from "../utils/stringTruncateHeadTail.js";
import type { EvalTrace } from "./evalRun.js";

const TOOL_RESULT_MAX_LENGTH = 800;

/**
 * Renders an eval trace into a human-readable markdown report.
 * Expects: trace history is chronological and events were captured from the same run window.
 */
export function evalTraceRender(trace: EvalTrace): string {
    const lines = [
        `# Eval Trace: ${trace.scenario.name}`,
        "",
        `- Agent: \`${trace.scenario.agent.kind}:${trace.scenario.agent.path}\``,
        `- Agent path: \`${trace.agentPath}\``,
        `- Agent id: \`${trace.agentId}\``,
        `- Started: ${new Date(trace.startedAt).toISOString()}`,
        `- Finished: ${new Date(trace.endedAt).toISOString()}`,
        `- Duration: ${trace.endedAt - trace.startedAt} ms`,
        `- Turns: ${trace.turnResults.length}`,
        `- Setup reset: ${trace.setup.durationMs} ms`,
        "",
        "## History",
        ""
    ];

    if (trace.history.length === 0) {
        lines.push("_No history recorded._", "");
    } else {
        for (const record of trace.history) {
            lines.push(...evalHistoryRender(record), "");
        }
    }

    lines.push("## Events", "");

    if (trace.events.length === 0) {
        lines.push("_No events captured._", "");
    } else {
        for (const event of trace.events) {
            lines.push(`- ${event.timestamp} \`${event.type}\` ${evalJsonInline(event.payload)}`);
        }
        lines.push("");
    }

    const tokenSummary = evalTokenSummaryBuild(trace.history);
    const eventCounts = evalEventCountsBuild(trace.events);
    lines.push("## Footer", "");
    lines.push(
        `- Token usage: input=${tokenSummary.input}, output=${tokenSummary.output}, cacheRead=${tokenSummary.cacheRead}, cacheWrite=${tokenSummary.cacheWrite}, total=${tokenSummary.total}`,
        `- Event counts: ${eventCounts.length > 0 ? eventCounts.join(", ") : "none"}`,
        `- History records: ${trace.history.length}`
    );

    return `${lines.join("\n").trimEnd()}\n`;
}

function evalHistoryRender(record: AgentHistoryRecord): string[] {
    if (record.type === "user_message") {
        return ["### User", "", record.text];
    }
    if (record.type === "assistant_message") {
        const text = messageContentExtractText(record.content);
        const toolCalls = messageContentExtractToolCalls(record.content);
        const lines = ["### Assistant", ""];

        if (text) {
            lines.push(text);
        }
        if (text && toolCalls.length > 0) {
            lines.push("");
        }
        if (toolCalls.length > 0) {
            lines.push(
                ...toolCalls.map((toolCall) => `> Tool Call: ${toolCall.name}(${evalJsonInline(toolCall.arguments)})`)
            );
        }
        if (!text && toolCalls.length === 0) {
            lines.push("_No assistant text content._");
        }

        return lines;
    }
    if (record.type === "assistant_rewrite") {
        return ["#### Assistant Rewrite", "", `> Reason: ${record.reason}`, `> Text: ${record.text}`];
    }
    if (record.type === "rlm_start") {
        const lines = ["#### Code Execution", ""];
        if (record.description) {
            lines.push(`> Description: ${record.description}`);
        }
        if (record.preamble) {
            lines.push(`> Preamble: ${record.preamble}`);
        }
        lines.push("", "```python", record.code, "```");
        return lines;
    }
    if (record.type === "rlm_tool_call") {
        return [`> Tool: ${record.toolName}(${evalJsonInline(record.toolArgs)})`];
    }
    if (record.type === "rlm_tool_result") {
        return [`> Result: ${stringTruncateHeadTail(record.toolResult, TOOL_RESULT_MAX_LENGTH, "tool result")}`];
    }
    if (record.type === "rlm_complete") {
        return [`> Output: ${record.output}`];
    }
    return [`> Note: ${record.text}`];
}

function evalTokenSummaryBuild(history: AgentHistoryRecord[]) {
    const summary = {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0
    };

    for (const record of history) {
        if (record.type !== "assistant_message" || !record.tokens) {
            continue;
        }
        summary.input += record.tokens.size.input;
        summary.output += record.tokens.size.output;
        summary.cacheRead += record.tokens.size.cacheRead;
        summary.cacheWrite += record.tokens.size.cacheWrite;
        summary.total += record.tokens.size.total;
    }

    return summary;
}

function evalEventCountsBuild(events: EvalTrace["events"]): string[] {
    const counts = new Map<string, number>();
    for (const event of events) {
        counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
    }
    return Array.from(counts.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([type, count]) => `${type}=${count}`);
}

function evalJsonInline(value: unknown): string {
    return JSON.stringify(value);
}
