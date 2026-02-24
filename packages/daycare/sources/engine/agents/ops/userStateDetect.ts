import type { Storage } from "../../../storage/storage.js";

export type UserState = "new_user" | "returning_user" | "active_user";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Classifies a user's engagement state based on account age, compaction history, and recency.
 *
 * - new_user: created < 7 days ago AND no compacted sessions (invalidatedAt not set)
 * - returning_user: has agents AND last activity > 3 days ago
 * - active_user: everything else
 *
 * Expects: userId exists in storage.
 */
export async function userStateDetect(storage: Storage, userId: string): Promise<UserState> {
    const now = Date.now();
    const user = await storage.users.findById(userId);
    if (!user) {
        return "new_user";
    }

    const agents = await storage.agents.findByUserId(userId);
    if (agents.length === 0) {
        return "new_user";
    }

    // Check compaction: any session with invalidatedAt set means user has gone through compaction
    const agentIds = agents.map((a) => a.id);
    let hasCompaction = false;
    let latestActivity = user.createdAt;

    for (const agentId of agentIds) {
        const sessions = await storage.sessions.findByAgentId(agentId);
        for (const session of sessions) {
            if (session.invalidatedAt !== null) {
                hasCompaction = true;
            }
        }
    }

    // Latest activity is the most recent agent updatedAt
    for (const agent of agents) {
        if (agent.updatedAt > latestActivity) {
            latestActivity = agent.updatedAt;
        }
    }

    // New user: created recently and no compaction yet
    const accountAge = now - user.createdAt;
    if (accountAge < SEVEN_DAYS_MS && !hasCompaction) {
        return "new_user";
    }

    // Returning user: last activity was more than 3 days ago
    const timeSinceLastActivity = now - latestActivity;
    if (timeSinceLastActivity > THREE_DAYS_MS) {
        return "returning_user";
    }

    return "active_user";
}
