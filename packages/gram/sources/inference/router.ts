import type { Context, AssistantMessage } from "@mariozechner/pi-ai";

import type { InferenceRegistry } from "./registry.js";
import type { InferenceProviderSettings } from "../settings.js";
import type { SecretsStore } from "../secrets/store.js";
import { getLogger } from "../log.js";

export type InferenceResult = {
  message: AssistantMessage;
  providerId: string;
  modelId: string;
};

export type InferenceRouterOptions = {
  providers: InferenceProviderSettings[];
  registry: InferenceRegistry;
  secrets: SecretsStore;
  onAttempt?: (providerId: string, modelId: string) => void;
  onFallback?: (providerId: string, error: unknown) => void;
  onSuccess?: (providerId: string, modelId: string, message: AssistantMessage) => void;
  onFailure?: (providerId: string, error: unknown) => void;
};

export class InferenceRouter {
  private providers: InferenceProviderSettings[];
  private registry: InferenceRegistry;
  private secrets: SecretsStore;
  private logger = getLogger("inference.router");

  constructor(options: InferenceRouterOptions) {
    this.providers = options.providers;
    this.registry = options.registry;
    this.secrets = options.secrets;
  }

  updateProviders(providers: InferenceProviderSettings[]): void {
    this.providers = providers;
  }

  async complete(
    context: Context,
    sessionId: string,
    options?: Omit<InferenceRouterOptions, "providers" | "registry" | "secrets">
  ): Promise<InferenceResult> {
    let lastError: unknown = null;

    for (const providerConfig of this.providers) {
      const provider = this.registry.get(providerConfig.id);
      if (!provider) {
        this.logger.warn({ provider: providerConfig.id }, "Missing inference provider");
        continue;
      }

      let client;
      try {
        client = await provider.createClient({
          model: providerConfig.model,
          config: providerConfig.options,
          secrets: this.secrets,
          logger: this.logger
        });
      } catch (error) {
        lastError = error;
        options?.onFallback?.(providerConfig.id, error);
        continue;
      }

      options?.onAttempt?.(providerConfig.id, client.modelId);
      try {
        const message = await client.complete(context, { sessionId });
        options?.onSuccess?.(providerConfig.id, client.modelId, message);
        return { message, providerId: providerConfig.id, modelId: client.modelId };
      } catch (error) {
        options?.onFailure?.(providerConfig.id, error);
        throw error;
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }
    throw new Error("No inference provider available");
  }
}
