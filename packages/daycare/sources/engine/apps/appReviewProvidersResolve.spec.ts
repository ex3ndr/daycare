import { describe, expect, it } from "vitest";

import { configResolve } from "../../config/configResolve.js";
import { appReviewProvidersResolve } from "./appReviewProvidersResolve.js";

describe("appReviewProvidersResolve", () => {
    it("returns undefined for default model selector", () => {
        const config = configResolve(
            {
                inference: { providers: [{ id: "openai", model: "gpt-5-mini" }] },
                engine: { dataDir: "/tmp/daycare-test-data" },
                assistant: { workspaceDir: "/tmp/daycare-test-workspace" }
            },
            "/tmp/daycare-test-settings.json"
        );

        expect(appReviewProvidersResolve(config, "default")).toBeUndefined();
    });

    it("supports provider:model selector", () => {
        const config = configResolve(
            {
                inference: {
                    providers: [
                        { id: "openai", model: "gpt-5-mini" },
                        { id: "anthropic", model: "claude-sonnet-4-5" }
                    ]
                },
                engine: { dataDir: "/tmp/daycare-test-data-2" },
                assistant: { workspaceDir: "/tmp/daycare-test-workspace-2" }
            },
            "/tmp/daycare-test-settings-2.json"
        );

        const override = appReviewProvidersResolve(config, "anthropic:claude-opus-4");
        expect(override).toHaveLength(1);
        expect(override?.[0]).toMatchObject({ id: "anthropic", model: "claude-opus-4" });
    });
});
