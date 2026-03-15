import { describe, expect, it } from "vitest";

import { voiceTranscriptApply } from "./voiceTranscriptApply";
import type { VoiceTranscriptEntry } from "./voiceTypes";

describe("voiceTranscriptApply", () => {
    it("appends user transcript events", () => {
        const result = voiceTranscriptApply(
            [],
            {
                type: "user_transcript",
                user_transcription_event: { user_transcript: "Hello there" }
            },
            () => "user-1"
        );

        expect(result).toEqual([
            {
                id: "user-1",
                role: "user",
                text: "Hello there"
            }
        ]);
    });

    it("replaces the latest agent entry on correction events", () => {
        const current: VoiceTranscriptEntry[] = [
            { id: "agent-1", role: "agent", text: "Orig" },
            { id: "user-1", role: "user", text: "Hi" },
            { id: "agent-2", role: "agent", text: "Wrong" }
        ];

        const result = voiceTranscriptApply(
            current,
            {
                type: "agent_response_correction",
                agent_response_correction_event: { corrected_agent_response: "Corrected" }
            },
            () => "agent-3"
        );

        expect(result).toEqual([
            { id: "agent-1", role: "agent", text: "Orig" },
            { id: "user-1", role: "user", text: "Hi" },
            { id: "agent-3", role: "agent", text: "Corrected" }
        ]);
    });

    it("ignores unrelated events", () => {
        const current: VoiceTranscriptEntry[] = [{ id: "user-1", role: "user", text: "Keep me" }];

        const result = voiceTranscriptApply(
            current,
            {
                type: "ping"
            },
            () => "ignored"
        );

        expect(result).toBe(current);
    });
});
