import type { Context as InferenceContext } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";

import type { AgentHistoryRecord } from "@/types";
import { getLogger } from "../../../log.js";
import { getProviderDefinition } from "../../../providers/catalog.js";
import { providerModelSelectBySize } from "../../../providers/providerModelSelectBySize.js";
import type { ProviderSettings } from "../../../settings.js";
import { agentPromptBundledRead } from "../../agents/ops/agentPromptBundledRead.js";
import { messageExtractText } from "../../messages/messageExtractText.js";
import type { InferenceRouter } from "../../modules/inference/router.js";
import { formatHistoryMessages } from "./utils/formatHistoryMessages.js";
import { parseObservations } from "./utils/parseObservations.js";

const logger = getLogger("memory.infer");

export type InferObservation = {
    content: string;
};

export type InferObservationsOptions = {
    records: AgentHistoryRecord[];
    inferenceRouter: InferenceRouter;
    providers: ProviderSettings[];
    signal?: AbortSignal;
};

/**
 * Runs inference on conversation history to extract observations worth persisting.
 * Expects: records from a single session, at least one provider available.
 */
export async function inferObservations(options: InferObservationsOptions): Promise<InferObservation[]> {
    const { records, inferenceRouter, providers, signal } = options;

    if (records.length === 0) {
        return [];
    }

    const transcript = formatHistoryMessages(records);
    if (transcript.trim().length === 0) {
        return [];
    }

    const systemPrompt = (await agentPromptBundledRead("memory/OBSERVE.md")).trim();

    const context: InferenceContext = {
        messages: [
            {
                role: "user",
                content: transcript,
                timestamp: Date.now()
            }
        ],
        systemPrompt
    };

    // Select normal-sized model for each provider
    const providersOverride = providers.map((provider) => {
        const definition = getProviderDefinition(provider.id);
        const models = definition?.models ?? [];
        const normalModel = providerModelSelectBySize(models, "normal");
        if (!normalModel) {
            return { ...provider };
        }
        return { ...provider, model: normalModel };
    });

    const sessionId = `memory-observe:${createId()}`;
    logger.debug(
        `start: inferObservations starting recordCount=${records.length} providerCount=${providersOverride.length}`
    );

    const result = await inferenceRouter.complete(context, sessionId, {
        providersOverride,
        signal
    });

    const text = messageExtractText(result.message)?.trim() ?? "";
    if (text.length === 0) {
        logger.debug("event: inferObservations produced empty response");
        return [];
    }

    const observations = parseObservations(text);
    if (observations.length === 0 && text.includes("observation")) {
        logger.warn("event: inferObservations found no valid <observation> tags in response");
    }
    return observations;
}
