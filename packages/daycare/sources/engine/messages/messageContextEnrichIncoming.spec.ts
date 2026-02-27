import { describe, expect, it, vi } from "vitest";
import { messageContextEnrichIncoming } from "./messageContextEnrichIncoming.js";

describe("messageContextEnrichIncoming", () => {
    it("auto-updates profile timezone and emits timezone/name notices", async () => {
        const timezonePersist = vi.fn(async () => undefined);
        const result = await messageContextEnrichIncoming({
            context: { messageId: "m1", timezone: "America/New_York" },
            user: { timezone: "UTC", firstName: null, lastName: null },
            timezonePersist
        });

        expect(timezonePersist).toHaveBeenCalledWith("America/New_York");
        expect(result.timezone).toBe("America/New_York");
        expect(result.enrichments).toEqual(
            expect.arrayContaining([
                {
                    key: "timezone_change_notice",
                    value: "Timezone updated automatically from UTC to America/New_York."
                },
                {
                    key: "profile_name_notice",
                    value: "User first/last name are not set. Ask the user and call user_profile_update ASAP."
                }
            ])
        );
    });

    it("keeps profile timezone when incoming timezone is missing", async () => {
        const timezonePersist = vi.fn(async () => undefined);
        const result = await messageContextEnrichIncoming({
            context: { messageId: "m1" },
            user: { timezone: "UTC", firstName: "Alice", lastName: null },
            timezonePersist
        });

        expect(timezonePersist).not.toHaveBeenCalled();
        expect(result.timezone).toBe("UTC");
        expect(result.enrichments).toBeUndefined();
    });

    it("ignores invalid incoming timezone and does not mutate profile", async () => {
        const timezonePersist = vi.fn(async () => undefined);
        const result = await messageContextEnrichIncoming({
            context: { timezone: "Mars/Base" },
            user: { timezone: "Europe/Berlin", firstName: "Bob", lastName: "B" },
            timezonePersist
        });

        expect(timezonePersist).not.toHaveBeenCalled();
        expect(result.timezone).toBe("Europe/Berlin");
    });
});
