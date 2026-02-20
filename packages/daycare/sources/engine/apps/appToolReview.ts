import type { Context, ToolCall } from "@mariozechner/pi-ai";
import type { ProviderSettings } from "../../settings.js";
import { messageExtractText } from "../messages/messageExtractText.js";
import type { InferenceRouter } from "../modules/inference/router.js";
import { appReviewPromptBuild } from "./appReviewPromptBuild.js";
import type { AppReviewDecision, AppRuleSet } from "./appTypes.js";

type AppToolReviewInput = {
    appId: string;
    appName: string;
    appSystemPrompt: string;
    rlmEnabled: boolean;
    sourceIntent: string;
    toolCall: ToolCall;
    rules: AppRuleSet;
    availableTools: Array<{
        name: string;
        description: string;
        parameters: unknown;
    }>;
    inferenceRouter: InferenceRouter;
    providersOverride?: ProviderSettings[];
};

/**
 * Calls the review model and decides whether an app tool call is allowed.
 * Expects: rules and toolCall were prepared by the app executor.
 */
export async function appToolReview(input: AppToolReviewInput): Promise<AppReviewDecision> {
    const reviewPrompt = await appReviewPromptBuild({
        appName: input.appName,
        appSystemPrompt: input.appSystemPrompt,
        rlmEnabled: input.rlmEnabled,
        sourceIntent: input.sourceIntent,
        toolName: input.toolCall.name,
        args: input.toolCall.arguments,
        rules: input.rules,
        availableTools: input.availableTools
    });
    const context: Context = {
        messages: [
            {
                role: "user",
                content: [{ type: "text", text: reviewPrompt }],
                timestamp: Date.now()
            }
        ]
    };

    try {
        const result = await input.inferenceRouter.complete(context, `app-review:${input.appId}`, {
            providersOverride: input.providersOverride
        });
        const text = messageExtractText(result.message)?.trim() ?? "";
        return appReviewDecisionParse(text);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { allowed: false, reason: `Review failed: ${message}` };
    }
}

function appReviewDecisionParse(text: string): AppReviewDecision {
    if (/^ALLOW\b/i.test(text)) {
        return { allowed: true };
    }
    const denyMatch = text.match(/^DENY\s*:\s*(.+)$/is);
    if (denyMatch) {
        const reason = denyMatch[1]?.trim();
        return { allowed: false, reason: reason && reason.length > 0 ? reason : "Denied by review model." };
    }
    if (/^DENY\b/i.test(text)) {
        return { allowed: false, reason: "Denied by review model." };
    }
    return { allowed: false, reason: "Review model returned an invalid decision." };
}
