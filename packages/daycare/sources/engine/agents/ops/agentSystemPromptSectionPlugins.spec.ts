import { describe, expect, it } from "vitest";
import { contextForAgent } from "../context.js";
import { agentSystemPromptSectionPlugins } from "./agentSystemPromptSectionPlugins.js";

describe("agentSystemPromptSectionPlugins", () => {
    it("returns an empty section when no plugin prompts are available", async () => {
        const section = await agentSystemPromptSectionPlugins({
            ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" })
        });
        expect(section).toBe("");
    });

    it("renders plugin prompt text as a dedicated section", async () => {
        const section = await agentSystemPromptSectionPlugins({
            ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
            pluginPrompts: [
                { text: "  Telegram user profile details.  " },
                { text: "Location: Biarritz" },
                { text: "  " }
            ]
        });

        expect(section).toContain("## Plugin Context");
        expect(section).toContain("Telegram user profile details.");
        expect(section).toContain("Location: Biarritz");
    });
});
