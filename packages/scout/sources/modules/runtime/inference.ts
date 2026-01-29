import {
  complete,
  getModel,
  stream,
  type Api,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  type Model,
  type ProviderStreamOptions
} from "@mariozechner/pi-ai";

import {
  DEFAULT_AUTH_PATH,
  getClaudeCodeToken,
  getCodexToken,
  readAuthFile
} from "../../auth.js";

export type InferenceClient = {
  model: Model<Api>;
  complete: (
    context: Context,
    options?: ProviderStreamOptions
  ) => Promise<AssistantMessage>;
  stream: (
    context: Context,
    options?: ProviderStreamOptions
  ) => AssistantMessageEventStream;
};

export type InferenceConnectOptions = {
  model: string;
  token?: string;
  authPath?: string;
};

export async function connectCodex(
  options: InferenceConnectOptions
): Promise<InferenceClient> {
  const apiKey = await resolveToken(
    options,
    getCodexToken,
    "codex"
  );
  const model = getModel("openai-codex", options.model as never);
  return buildClient(model as Model<Api>, apiKey);
}

export async function connectClaudeCode(
  options: InferenceConnectOptions
): Promise<InferenceClient> {
  const apiKey = await resolveToken(
    options,
    getClaudeCodeToken,
    "claude-code"
  );
  const model = getModel("anthropic", options.model as never);
  return buildClient(model as Model<Api>, apiKey);
}

async function resolveToken(
  options: InferenceConnectOptions,
  picker: (auth: Awaited<ReturnType<typeof readAuthFile>>) => string | null,
  label: string
): Promise<string> {
  if (options.token) {
    return options.token;
  }

  const authPath = options.authPath ?? DEFAULT_AUTH_PATH;
  const auth = await readAuthFile(authPath);
  const token = picker(auth);

  if (!token) {
    throw new Error(`Missing ${label} token in ${authPath}`);
  }

  return token;
}

function buildClient(
  model: Model<Api>,
  apiKey: string
): InferenceClient {
  return {
    model,
    complete: (context, options) =>
      complete(model, context, { ...options, apiKey: options?.apiKey ?? apiKey }),
    stream: (context, options) =>
      stream(model, context, { ...options, apiKey: options?.apiKey ?? apiKey })
  };
}
