import { describe, expect, it } from "vitest";
import { messageContextEnrichIncoming } from "./messageContextEnrichIncoming.js";

describe("messageContextEnrichIncoming", () => {
    it("adds timezone update nudge when incoming timezone differs from profile", async () => {
        const result = await messageContextEnrichIncoming({
            context: { messageId: "m1", timezone: "America/New_York" },
            user: { timezone: "UTC", firstName: null, lastName: null }
        });

        expect(result.timezone).toBe("America/New_York");
        expect(result.enrichments).toEqual(
            expect.arrayContaining([
                {
                    key: "timezone_change_notice",
                    value: "Message context timezone changed from profile timezone UTC to America/New_York. Update profile timezone with user_profile_update."
                },
                {
                    key: "profile_name_notice",
                    value: "User first/last name are not set. If the name is visible from the context (e.g. connector profile, message signature), set it via user_profile_update. Otherwise, ask the user for their name."
                }
            ])
        );
    });

    it("keeps profile timezone when incoming timezone is missing", async () => {
        const result = await messageContextEnrichIncoming({
            context: { messageId: "m1" },
            user: { timezone: "UTC", firstName: "Alice", lastName: null }
        });

        expect(result.timezone).toBe("UTC");
        expect(result.enrichments).toBeUndefined();
    });

    it("ignores invalid incoming timezone and does not mutate profile", async () => {
        const result = await messageContextEnrichIncoming({
            context: { timezone: "Mars/Base" },
            user: { timezone: "Europe/Berlin", firstName: "Bob", lastName: "B" }
        });

        expect(result.timezone).toBe("Europe/Berlin");
    });

    it("adds timezone set nudge when profile timezone is missing and incoming timezone is available", async () => {
        const result = await messageContextEnrichIncoming({
            context: { messageId: "m1", timezone: "America/New_York" },
            user: { timezone: null, firstName: "Alice", lastName: "A" }
        });

        expect(result.timezone).toBe("America/New_York");
        expect(result.enrichments).toEqual([
            {
                key: "timezone_set_notice",
                value: "Timezone America/New_York is available in message context while profile timezone is unset. Set it with user_profile_update without asking the user again."
            }
        ]);
    });

    it("adds timezone nudge when both incoming and profile timezone are missing", async () => {
        const result = await messageContextEnrichIncoming({
            context: { messageId: "m1" },
            user: { timezone: null, firstName: "Alice", lastName: "A" }
        });

        expect(result.timezone).toBeUndefined();
        expect(result.enrichments).toEqual([
            {
                key: "timezone_missing_notice",
                value: "User timezone is not set. Ask the user for their timezone and set it via user_profile_update."
            }
        ]);
    });
});
