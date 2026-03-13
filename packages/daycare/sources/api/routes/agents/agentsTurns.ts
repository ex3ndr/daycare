import type { AgentHistoryRecord, Context } from "@/types";

export type AgentTurn = {
    /** Stable turn identity derived from the first record's timestamp. */
    id: number;
    startedAt: number;
    preview: string;
    records: AgentHistoryRecord[];
};

export type AgentsTurnsInput = {
    ctx: Context;
    agentId: string;
    agentHistoryLoad: (ctx: Context, agentId: string, limit?: number) => Promise<AgentHistoryRecord[]>;
};

export type AgentsTurnsResult = { ok: true; turns: AgentTurn[] } | { ok: false; error: string };

/**
 * Groups flat agent history into turns.
 * A turn starts at each user_message and includes all records until the next user_message.
 * Records before the first user_message are grouped into turn 0.
 */
export async function agentsTurns(input: AgentsTurnsInput): Promise<AgentsTurnsResult> {
    const agentId = input.agentId.trim();
    if (!agentId) {
        return { ok: false, error: "agentId is required." };
    }

    try {
        const history = await input.agentHistoryLoad(input.ctx, agentId);
        const turns = turnsBuild(history);
        return { ok: true, turns };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load agent history.";
        return { ok: false, error: message };
    }
}

/**
 * Splits a sorted history array into turn groups.
 * Each user_message starts a new turn. Pre-user records form an initial turn.
 */
function turnsBuild(history: AgentHistoryRecord[]): AgentTurn[] {
    // History comes sorted ascending by `at`
    const sorted = [...history].sort((a, b) => a.at - b.at);
    const turns: AgentTurn[] = [];
    let current: AgentHistoryRecord[] = [];

    for (const record of sorted) {
        if (record.type === "user_message" && current.length > 0) {
            turns.push(turnCreate(current));
            current = [];
        }
        current.push(record);
    }

    if (current.length > 0) {
        turns.push(turnCreate(current));
    }

    return turns;
}

function turnCreate(records: AgentHistoryRecord[]): AgentTurn {
    const first = records[0];
    if (!first) {
        return { id: 0, startedAt: 0, preview: "", records };
    }
    const startedAt = first.at;
    const firstUser = records.find((r) => r.type === "user_message");
    const preview = firstUser && "text" in firstUser ? (firstUser.text as string) : "";
    return { id: startedAt, startedAt, preview, records };
}
