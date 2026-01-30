import type {
  AssistantMessage,
  AssistantMessageEventStream,
  Context,
  ProviderStreamOptions
} from "@mariozechner/pi-ai";
import type { Logger } from "pino";

import type { SecretsStore } from "../secrets/store.js";

export type InferenceClient = {
  modelId: string;
  complete: (
    context: Context,
    options?: ProviderStreamOptions
  ) => Promise<AssistantMessage>;
  stream: (
    context: Context,
    options?: ProviderStreamOptions
  ) => AssistantMessageEventStream;
};

export type InferenceProviderOptions = {
  model?: string;
  config?: Record<string, unknown>;
  secrets: SecretsStore;
  logger: Logger;
};

export type InferenceProvider = {
  id: string;
  label: string;
  createClient: (options: InferenceProviderOptions) => Promise<InferenceClient>;
};
