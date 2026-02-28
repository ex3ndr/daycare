import { describe, expect, it } from "vitest";

import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForUser } from "../context.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";
import { agentSystemPromptSectionEnvironment } from "./agentSystemPromptSectionEnvironment.js";

describe("agentSystemPromptSectionEnvironment", () => {
    it("renders profile timezone when available", async () => {
        const storage = await storageOpenTest();
        try {
            await storage.users.create({
                id: "user-1",
                nametag: "timezone-user",
                timezone: "America/New_York"
            });

            const section = await agentSystemPromptSectionEnvironment({
                ctx: contextForUser({ userId: "user-1" }),
                descriptor: {
                    type: "user",
                    connector: "telegram",
                    channelId: "channel-1",
                    userId: "telegram-1"
                },
                agentSystem: {
                    storage
                } as unknown as NonNullable<AgentSystemPromptContext["agentSystem"]>
            });

            expect(section).toContain("- Timezone: `America/New_York`");
        } finally {
            storage.connection.close();
        }
    });

    it("omits timezone row when profile timezone is unset", async () => {
        const storage = await storageOpenTest();
        try {
            await storage.users.create({
                id: "user-1",
                nametag: "timezone-user"
            });

            const section = await agentSystemPromptSectionEnvironment({
                ctx: contextForUser({ userId: "user-1" }),
                descriptor: {
                    type: "user",
                    connector: "telegram",
                    channelId: "channel-1",
                    userId: "telegram-1"
                },
                agentSystem: {
                    storage
                } as unknown as NonNullable<AgentSystemPromptContext["agentSystem"]>
            });

            expect(section).not.toContain("- Timezone:");
        } finally {
            storage.connection.close();
        }
    });
});
