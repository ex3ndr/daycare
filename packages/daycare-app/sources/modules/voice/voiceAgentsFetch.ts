import { apiUrl } from "../api/apiUrl";
import type { VoiceAgentRecord, VoiceSessionStartPayload } from "./voiceTypes";

/**
 * Fetches all voice agents for the current workspace.
 * Expects: baseUrl/token identify an authenticated app session.
 */
export async function voiceAgentsFetch(
    baseUrl: string,
    token: string,
    workspaceId: string | null
): Promise<VoiceAgentRecord[]> {
    const response = await fetch(apiUrl(baseUrl, "/voice-agents", workspaceId), {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; voiceAgents?: VoiceAgentRecord[]; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch voice agents");
    }
    return data.voiceAgents ?? [];
}

export async function voiceAgentRead(
    baseUrl: string,
    token: string,
    workspaceId: string | null,
    voiceAgentId: string
): Promise<VoiceAgentRecord> {
    const response = await fetch(apiUrl(baseUrl, `/voice-agents/${encodeURIComponent(voiceAgentId)}`, workspaceId), {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; voiceAgent?: VoiceAgentRecord; error?: string };
    if (data.ok !== true || !data.voiceAgent) {
        throw new Error(data.error ?? "Failed to read voice agent");
    }
    return data.voiceAgent;
}

export async function voiceSessionStart(
    baseUrl: string,
    token: string,
    workspaceId: string | null,
    voiceAgentId: string
): Promise<VoiceSessionStartPayload> {
    const response = await fetch(
        apiUrl(baseUrl, `/voice-agents/${encodeURIComponent(voiceAgentId)}/session/start`, workspaceId),
        {
            method: "POST",
            headers: {
                authorization: `Bearer ${token}`,
                "content-type": "application/json"
            },
            body: JSON.stringify({})
        }
    );
    const data = (await response.json()) as {
        ok?: boolean;
        providerId?: string;
        voiceAgent?: VoiceAgentRecord;
        session?: VoiceSessionStartPayload["session"];
        error?: string;
    };
    if (data.ok !== true || !data.providerId || !data.voiceAgent || !data.session) {
        throw new Error(data.error ?? "Failed to start voice session");
    }
    return {
        providerId: data.providerId,
        voiceAgent: data.voiceAgent,
        session: data.session
    };
}
