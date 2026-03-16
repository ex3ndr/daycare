import type { AssistantMessage, Context } from "@mariozechner/pi-ai";
import type { AuthStore } from "../../../auth/store.js";
import { getLogger } from "../../../log.js";
import { listActiveInferenceProviders } from "../../../providers/catalog.js";
import { providerSettingsResolveModel } from "../../../providers/providerSettingsResolveModel.js";
import type { ProviderSettings } from "../../../settings.js";
import type { ConfigModule } from "../../config/configModule.js";
import type { InferenceRegistry } from "../inferenceRegistry.js";
import { inferenceOutputTokensValidate } from "./inferenceOutputTokensValidate.js";

export type InferenceResult = {
    message: AssistantMessage;
    providerId: string;
    modelId: string;
};

export type InferenceRouterOptions = {
    registry: InferenceRegistry;
    auth: AuthStore;
    config: ConfigModule;
};

export type InferenceCompleteOptions = {
    onAttempt?: (providerId: string, modelId: string) => void;
    onFallback?: (providerId: string, error: unknown) => void;
    onSuccess?: (providerId: string, modelId: string, message: AssistantMessage) => void;
    onFailure?: (providerId: string, error: unknown) => void;
    providersOverride?: ProviderSettings[];
    signal?: AbortSignal;
    providerOptions?: Record<string, unknown>;
};

export class InferenceRouter {
    private providers: ProviderSettings[];
    private registry: InferenceRegistry;
    private auth: AuthStore;
    private config: ConfigModule;
    private logger = getLogger("inference.router");

    constructor(options: InferenceRouterOptions) {
        this.providers = [];
        this.registry = options.registry;
        this.auth = options.auth;
        this.config = options.config;
        this.reload();
        this.logger.debug(`init: InferenceRouter initialized providerCount=${this.providers.length}`);
    }

    reload(): void {
        const providers = listActiveInferenceProviders(this.config.current.settings);
        const providerIds = providers.map((p) => p.id).join(",");
        this.logger.debug(
            `event: Updating providers oldCount=${this.providers.length} newCount=${providers.length} providerIds=${providerIds}`
        );
        this.providers = providers;
    }

    async complete(context: Context, sessionId: string, options?: InferenceCompleteOptions): Promise<InferenceResult> {
        const execute = async (): Promise<InferenceResult> => {
            const providers = options?.providersOverride ?? this.providers;
            this.logger.debug(
                `start: InferenceRouter.complete() starting sessionId=${sessionId} messageCount=${context.messages.length} toolCount=${context.tools?.length ?? 0} providerCount=${providers.length}`
            );
            let lastError: unknown = null;

            for (const [index, providerConfig] of providers.entries()) {
                const resolvedProviderConfig = providerSettingsResolveModel(providerConfig);
                this.logger.debug(
                    `event: Trying provider providerIndex=${index} providerId=${resolvedProviderConfig.id} model=${resolvedProviderConfig.model}`
                );

                const provider = this.registry.get(resolvedProviderConfig.id);
                if (!provider) {
                    this.logger.warn({ provider: resolvedProviderConfig.id }, "event: Missing inference provider");
                    this.logger.debug(
                        `skip: Provider not found in registry, skipping providerId=${resolvedProviderConfig.id}`
                    );
                    continue;
                }

                let client: Awaited<ReturnType<typeof provider.createClient>>;
                try {
                    this.logger.debug(
                        `event: Creating inference client providerId=${resolvedProviderConfig.id} model=${resolvedProviderConfig.model}`
                    );
                    client = await provider.createClient({
                        model: resolvedProviderConfig.model,
                        config: resolvedProviderConfig.options,
                        auth: this.auth,
                        logger: this.logger
                    });
                    this.logger.debug(
                        `create: Inference client created providerId=${resolvedProviderConfig.id} modelId=${client.modelId}`
                    );
                } catch (error) {
                    this.logger.debug(
                        `error: Failed to create client, falling back providerId=${resolvedProviderConfig.id} error=${String(error)}`
                    );
                    lastError = error;
                    options?.onFallback?.(resolvedProviderConfig.id, error);
                    continue;
                }

                options?.onAttempt?.(resolvedProviderConfig.id, client.modelId);
                try {
                    this.logger.debug(
                        `event: Calling client.complete() providerId=${resolvedProviderConfig.id} modelId=${client.modelId} sessionId=${sessionId}`
                    );
                    // Provider API expects `sessionId`; caller owns how this is scoped/rotated.
                    const providerOptions = {
                        ...(resolvedProviderConfig.reasoning ? { reasoning: resolvedProviderConfig.reasoning } : {}),
                        ...(options?.providerOptions ?? {}),
                        sessionId,
                        signal: options?.signal
                    };
                    const message = await client.complete(context, {
                        ...providerOptions
                    });
                    inferenceOutputTokensValidate(message);
                    this.logger.debug(
                        `event: Inference completed successfully providerId=${resolvedProviderConfig.id} modelId=${client.modelId} stopReason=${message.stopReason} contentBlocks=${message.content.length} inputTokens=${message.usage?.input} outputTokens=${message.usage?.output}`
                    );
                    options?.onSuccess?.(resolvedProviderConfig.id, client.modelId, message);
                    return { message, providerId: resolvedProviderConfig.id, modelId: client.modelId };
                } catch (error) {
                    this.logger.debug(
                        `error: Inference call failed providerId=${resolvedProviderConfig.id} error=${String(error)}`
                    );
                    options?.onFailure?.(resolvedProviderConfig.id, error);
                    throw error;
                }
            }

            this.logger.debug(`event: All providers exhausted lastError=${String(lastError)}`);
            if (lastError instanceof Error) {
                throw lastError;
            }
            throw new Error("No inference provider available");
        };

        // Intentionally lock the full provider call to keep reload quiescence strict.
        return this.config.inReadLock(execute);
    }
}
