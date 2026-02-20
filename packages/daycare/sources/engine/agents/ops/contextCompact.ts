import type { Context } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";

import { getLogger } from "../../../log.js";
import { getProviderDefinition } from "../../../providers/catalog.js";
import { providerModelSelectBySize } from "../../../providers/providerModelSelectBySize.js";
import type { ProviderSettings } from "../../../settings.js";
import { messageExtractText } from "../../messages/messageExtractText.js";
import type { InferenceRouter } from "../../modules/inference/router.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import { compactionLogAppend } from "./compactionLogAppend.js";

type ContextCompactOptions = {
    context: Context;
    inferenceRouter: InferenceRouter;
    providers: ProviderSettings[];
    providerId?: string;
    inferenceSessionId?: string;
    signal?: AbortSignal;
    compactionLog?: {
        agentsDir: string;
        agentId: string;
    };
};

const logger = getLogger("agents.context-compact");
const COMPACTION_REQUEST_TEXT = [
    "Summarize the conversation above into a compact context checkpoint.",
    "Follow the system prompt format exactly.",
    "Do not continue the conversation."
].join(" ");

/**
 * Compacts a conversation context into a single summary message.
 * Expects: context contains the full session messages to compress.
 */
export async function contextCompact(options: ContextCompactOptions): Promise<Context> {
    const { context, inferenceRouter, providers, providerId, inferenceSessionId, signal, compactionLog } = options;
    if (!context.messages || context.messages.length === 0) {
        return { messages: [] };
    }

    const compactionPrompt = (await agentPromptBundledRead("COMPACTION.md")).trim();
    const compactionContext: Context = {
        messages: [
            ...context.messages,
            {
                role: "user",
                content: COMPACTION_REQUEST_TEXT,
                timestamp: Date.now()
            }
        ],
        systemPrompt: compactionPrompt
    };

    const selectedProviders = providerId ? providers.filter((provider) => provider.id === providerId) : providers;
    if (providerId && selectedProviders.length === 0) {
        throw new Error(`Unknown inference provider: ${providerId}`);
    }
    if (selectedProviders.length === 0) {
        throw new Error("No inference provider available");
    }

    const providersOverride = selectedProviders.map((provider) => {
        const definition = getProviderDefinition(provider.id);
        const models = definition?.models ?? [];
        const normalModel = providerModelSelectBySize(models, "normal");
        if (!normalModel) {
            return { ...provider };
        }
        return { ...provider, model: normalModel };
    });

    logger.debug(
        `start: contextCompact starting messageCount=${context.messages.length} providerCount=${providersOverride.length}`
    );
    const startedAt = Date.now();
    const sessionId = inferenceSessionId ?? `compaction:${createId()}`;
    let response: Awaited<ReturnType<InferenceRouter["complete"]>> | null = null;
    let error: unknown;
    let summaryText = "";
    try {
        response = await inferenceRouter.complete(compactionContext, sessionId, {
            providersOverride,
            signal
        });

        summaryText = messageExtractText(response.message)?.trim() ?? "";
        if (!summaryText) {
            logger.debug("event: contextCompact produced empty summary; returning empty compacted context");
            return { messages: [] };
        }

        return {
            messages: [
                {
                    ...response.message,
                    content: [{ type: "text", text: summaryText }]
                }
            ]
        };
    } catch (caughtError) {
        error = caughtError;
        throw caughtError;
    } finally {
        if (compactionLog) {
            try {
                await compactionLogAppend({
                    agentsDir: compactionLog.agentsDir,
                    agentId: compactionLog.agentId,
                    startedAt,
                    finishedAt: Date.now(),
                    sessionId,
                    requestContext: compactionContext,
                    providersOverride,
                    providerId: response?.providerId,
                    modelId: response?.modelId,
                    responseMessage: response?.message,
                    summaryText,
                    error
                });
            } catch (logError) {
                logger.warn({ error: logError, agentId: compactionLog.agentId }, "error: Compaction log write failed");
            }
        }
    }
}
