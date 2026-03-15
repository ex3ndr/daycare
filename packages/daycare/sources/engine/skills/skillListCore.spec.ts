import { describe, expect, it } from "vitest";

import { skillListCore } from "./skillListCore.js";

describe("skillListCore", () => {
    it("includes the voice agent creator skill with its documented hidden tool", async () => {
        const skills = await skillListCore();

        expect(skills).toContainEqual(
            expect.objectContaining({
                id: "core:autonomous-ai-agents/voice-agents-creator",
                name: "voice-agents-creator",
                tools: ["voice_agent_create"]
            })
        );
    });
});
