import { describe, expect, it } from "vitest";

import { listProviderModels } from "../../../providers/models.js";
import { contextForAgent } from "../context.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";
import { agentSystemPromptSectionModels } from "./agentSystemPromptSectionModels.js";

type AgentSystemPromptAgentSystem = NonNullable<AgentSystemPromptContext["agentSystem"]>;

describe("agentSystemPromptSectionModels", () => {
    it("returns an empty section when agentSystem context is missing", async () => {
        const section = await agentSystemPromptSectionModels({
            ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" })
        });
        expect(section).toBe("");
    });

    it("renders model awareness with active provider catalogs", async () => {
        const section = await agentSystemPromptSectionModels(
            contextBuild(["anthropic", "openai"], {
                model: "claude-sonnet-4-5",
                provider: "anthropic"
            })
        );

        expect(section).toContain("## Model Awareness");
        expect(section).toContain("You are running on **claude-sonnet-4-5** via **anthropic**.");
        expect(section).toContain("### Available Models");
        expect(section).toContain("**Anthropic**:");
        expect(section).toContain("**OpenAI**:");
        expect(section).toContain("- ");

        const activeAnthropicModel = listProviderModels("anthropic").find((model) => model.deprecated !== true);
        expect(activeAnthropicModel).toBeDefined();
        expect(section).toContain(`\`${activeAnthropicModel!.id}\` (${activeAnthropicModel!.size})`);

        const deprecatedAnthropicModel = listProviderModels("anthropic").find((model) => model.deprecated === true);
        if (deprecatedAnthropicModel) {
            expect(section).not.toContain(`\`${deprecatedAnthropicModel.id}\` (${deprecatedAnthropicModel.size})`);
        }
    });

    it("renders providers without model catalogs as explicit no-catalog entries", async () => {
        const section = await agentSystemPromptSectionModels(contextBuild(["openai-compatible"]));

        expect(section).toContain("**OpenAI-compatible**:");
        expect(section).toContain("- No non-deprecated models in the local catalog.");
    });

    it("ignores unknown provider ids and falls back to the no-provider message", async () => {
        const section = await agentSystemPromptSectionModels(contextBuild(["unknown-provider"]));

        expect(section).toContain("No active inference providers are configured.");
        expect(section).not.toContain("unknown-provider");
    });
});

function contextBuild(
    providerIds: string[],
    modelContext: Pick<AgentSystemPromptContext, "model" | "provider"> = {}
): AgentSystemPromptContext {
    return {
        ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
        model: modelContext.model ?? "unknown",
        provider: modelContext.provider ?? "unknown",
        agentSystem: {
            config: {
                current: {
                    settings: {
                        providers: providerIds.map((id) => ({ id, enabled: true }))
                    }
                }
            }
        } as unknown as AgentSystemPromptAgentSystem
    };
}
