import type { VoiceConversationEvent, VoiceTranscriptEntry } from "./voiceTypes";

/**
 * Applies a voice conversation event to the transcript, folding corrections into the latest agent entry.
 * Expects: events come from the ElevenLabs conversation stream.
 */
export function voiceTranscriptApply(
    current: VoiceTranscriptEntry[],
    event: VoiceConversationEvent,
    createId: (role: VoiceTranscriptEntry["role"]) => string = voiceTranscriptIdCreate
): VoiceTranscriptEntry[] {
    const nextEntry = voiceTranscriptEntryFromEvent(event, createId);
    if (!nextEntry) {
        return current;
    }

    if (event.type === "agent_response_correction" && nextEntry.role === "agent") {
        const updated = [...current];
        for (let index = updated.length - 1; index >= 0; index -= 1) {
            if (updated[index]?.role === "agent") {
                updated[index] = nextEntry;
                return updated;
            }
        }
    }

    return [...current, nextEntry];
}

function voiceTranscriptEntryFromEvent(
    event: VoiceConversationEvent,
    createId: (role: VoiceTranscriptEntry["role"]) => string
): VoiceTranscriptEntry | null {
    if (event.type === "user_transcript" && event.user_transcription_event?.user_transcript?.trim()) {
        return {
            id: createId("user"),
            role: "user",
            text: event.user_transcription_event.user_transcript.trim()
        };
    }
    if (event.type === "agent_response" && event.agent_response_event?.agent_response?.trim()) {
        return {
            id: createId("agent"),
            role: "agent",
            text: event.agent_response_event.agent_response.trim()
        };
    }
    if (
        event.type === "agent_response_correction" &&
        event.agent_response_correction_event?.corrected_agent_response?.trim()
    ) {
        return {
            id: createId("agent"),
            role: "agent",
            text: event.agent_response_correction_event.corrected_agent_response.trim()
        };
    }
    return null;
}

function voiceTranscriptIdCreate(role: VoiceTranscriptEntry["role"]): string {
    return `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
