import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForUser } from "../context.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";
import { agentSystemPromptSectionPreamble } from "./agentSystemPromptSectionPreamble.js";

const fixedNowAt = new Date("2026-03-15T01:30:00.000Z").getTime();
const originalTz = process.env.TZ;

describe("agentSystemPromptSectionPreamble", () => {
    beforeEach(() => {
        vi.spyOn(Date, "now").mockReturnValue(fixedNowAt);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        if (originalTz === undefined) {
            delete process.env.TZ;
            return;
        }
        process.env.TZ = originalTz;
    });

    it("renders the current date in the profile timezone and includes the timezone", async () => {
        const storage = await storageOpenTest();
        try {
            await storage.users.create({
                id: "user-1",
                nametag: "timezone-user",
                timezone: "America/Los_Angeles"
            });

            const section = await agentSystemPromptSectionPreamble({
                ctx: contextForUser({ userId: "user-1" }),
                path: "/user-1/telegram",
                agentSystem: {
                    storage
                } as unknown as NonNullable<AgentSystemPromptContext["agentSystem"]>
            });

            expect(section).toContain("Current date: 2026-03-14 (timezone: America/Los_Angeles)");
        } finally {
            storage.connection.close();
        }
    });

    it("falls back to the runtime timezone when the profile timezone is unavailable", async () => {
        process.env.TZ = "America/New_York";

        const section = await agentSystemPromptSectionPreamble({
            ctx: contextForUser({ userId: "user-1" }),
            path: "/user-1/telegram"
        });

        expect(section).toContain("Current date: 2026-03-14 (timezone: America/New_York)");
    });
});
