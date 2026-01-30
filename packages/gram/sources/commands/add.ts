import path from "node:path";

import { confirm, input, select } from "@inquirer/prompts";
import { createId } from "@paralleldrive/cuid2";
import { getModels, getOAuthProvider, type OAuthProviderId } from "@mariozechner/pi-ai";

import { AuthStore } from "../auth/store.js";
import { ConnectorRegistry } from "../connectors/registry.js";
import { FileStore } from "../files/store.js";
import { ImageGenerationRegistry } from "../images/registry.js";
import { InferenceRegistry } from "../inference/registry.js";
import { ToolRegistry } from "../tools/registry.js";
import { PluginManager } from "../plugins/manager.js";
import { buildPluginCatalog } from "../plugins/catalog.js";
import { PluginEventQueue } from "../plugins/events.js";
import { PluginRegistry } from "../plugins/registry.js";
import { PluginModuleLoader } from "../plugins/loader.js";
import {
  DEFAULT_SETTINGS_PATH,
  readSettingsFile,
  updateSettingsFile,
  upsertPlugin,
  type InferenceProviderSettings,
  type PluginInstanceSettings
} from "../settings.js";
import { PROVIDER_DEFINITIONS, type ProviderDefinition } from "../plugins/providers.js";

export type AddOptions = {
  settings?: string;
};

export async function addCommand(options: AddOptions): Promise<void> {
  intro("gram add");

  const settingsPath = path.resolve(options.settings ?? DEFAULT_SETTINGS_PATH);
  const settings = await readSettingsFile(settingsPath);
  const dataDir = path.resolve(settings.engine?.dataDir ?? ".scout");
  const authStore = new AuthStore(path.join(dataDir, "auth.json"));

  const addTarget = await promptValue(
    select({
      message: "What do you want to add?",
      choices: [
        { value: "provider", name: "Inference provider" },
        { value: "plugin", name: "Plugin" }
      ]
    })
  );

  if (addTarget === null) {
    outro("Cancelled.");
    return;
  }

  if (addTarget === "plugin") {
    await addPlugin(settingsPath, settings, dataDir, authStore);
    return;
  }

  await addProvider(settingsPath, authStore);
}

async function addProvider(
  settingsPath: string,
  authStore: AuthStore
): Promise<void> {
  const providers = PROVIDER_DEFINITIONS.map((provider) => ({
    ...provider,
    description: provider.label
  }));

  const providerId = await promptValue<string>(
    select({
      message: "Select an inference provider",
      choices: providers.map((provider) => ({
        value: provider.id,
        name: provider.label,
        description: provider.auth === "oauth"
          ? "OAuth"
          : provider.auth === "none"
            ? "No API key"
            : provider.auth === "mixed"
              ? "API key or OAuth"
              : provider.optionalApiKey
                ? "API key (optional)"
                : "API key"
      }))
    })
  );

  if (providerId === null) {
    outro("Cancelled.");
    return;
  }

  const provider = providers.find((entry) => entry.id === providerId);
  if (!provider) {
    outro("Unknown provider selection.");
    return;
  }

  try {
    await configureAuth(provider, authStore);
  } catch (error) {
    outro("Cancelled.");
    return;
  }

  const model = await selectModel(provider);
  if (!model) {
    outro("Cancelled.");
    return;
  }

  const providerOptions = await collectProviderOptions(provider);
  if (providerOptions === null) {
    outro("Cancelled.");
    return;
  }

  const setMain = await promptValue<boolean>(
    confirm({
      message: "Make this the primary inference provider?",
      default: false
    })
  );

  if (setMain === null) {
    outro("Cancelled.");
    return;
  }

  await updateSettingsFile(settingsPath, (current) => {
    const updatedProvider: InferenceProviderSettings = {
      id: provider.id,
      model,
      options: Object.keys(providerOptions).length > 0 ? providerOptions : undefined
    };
    const providersList = current.inference?.providers ?? [];
    const filtered = providersList.filter((entry) => entry.id !== provider.id);
    const nextProviders = setMain ? [updatedProvider, ...filtered] : [...filtered, updatedProvider];
    return {
      ...current,
      plugins: upsertPlugin(current.plugins, {
        instanceId: provider.id,
        pluginId: provider.id,
        enabled: true
      }),
      inference: {
        ...(current.inference ?? {}),
        providers: nextProviders
      }
    };
  });

  outro(`Added ${provider.label}. Restart the engine to apply changes.`);
}

async function addPlugin(
  settingsPath: string,
  settings: Awaited<ReturnType<typeof readSettingsFile>>,
  dataDir: string,
  authStore: AuthStore
): Promise<void> {
  const catalog = buildPluginCatalog();
  const providerIds = new Set(PROVIDER_DEFINITIONS.map((provider) => provider.id));
  const plugins = Array.from(catalog.values()).filter(
    (entry) => !providerIds.has(entry.descriptor.id)
  );

  if (plugins.length === 0) {
    outro("No plugins available.");
    return;
  }

  const pluginId = await promptValue(
    select({
      message: "Select a plugin",
      choices: plugins.map((entry) => ({
        value: entry.descriptor.id,
        name: entry.descriptor.name,
        description: entry.descriptor.description
      }))
    })
  );

  if (pluginId === null) {
    outro("Cancelled.");
    return;
  }

  const definition = catalog.get(pluginId);
  if (!definition) {
    outro("Unknown plugin selection.");
    return;
  }

  const instanceId = createId();
  let settingsConfig: Record<string, unknown> = {};

  const loader = new PluginModuleLoader(`onboarding:${instanceId}`);
  const { module } = await loader.load(definition.entryPath);
  if (module.onboarding) {
    const prompts = createPromptHelpers();
    const result = await module.onboarding({
      instanceId,
      pluginId,
      auth: authStore,
      prompt: prompts,
      note
    });
    if (result === null) {
      outro("Cancelled.");
      return;
    }
    settingsConfig = result.settings ?? {};
  } else {
    note("No onboarding flow provided; using default settings.", "Plugin");
  }

  try {
    await validatePluginLoad(
      settings,
      dataDir,
      authStore,
      {
        instanceId,
        pluginId,
        enabled: true,
        settings: settingsConfig
      }
    );
  } catch (error) {
    outro(`Plugin failed to load: ${(error as Error).message}`);
    return;
  }

  await updateSettingsFile(settingsPath, (current) => {
    const nextSettings =
      Object.keys(settingsConfig).length > 0 ? settingsConfig : undefined;
    return {
      ...current,
      plugins: upsertPlugin(current.plugins, {
        instanceId,
        pluginId,
        enabled: true,
        settings: nextSettings
      })
    };
  });

  outro(
    `Added ${definition.descriptor.name} (${instanceId}). Restart the engine to apply changes.`
  );
}

async function configureAuth(provider: ProviderDefinition, authStore: AuthStore): Promise<void> {
  if (provider.auth === "none") {
    note("This provider uses environment or cloud credentials. No API key stored.", "Auth");
    return;
  }

  if (provider.auth === "oauth" || provider.auth === "mixed") {
    const wantsOAuth = provider.auth === "oauth"
      ? true
      : await promptValue<boolean>(
          confirm({
            message: "Use OAuth instead of an API key?",
            default: false
          })
        );

    if (wantsOAuth === null) {
      throw new Error("Cancelled");
    }

    if (wantsOAuth) {
      await loginOAuth(provider, authStore);
      return;
    }
  }

  const apiKey = await promptValue(
    input({
      message: provider.optionalApiKey
        ? `${provider.label} API key (optional)`
        : `${provider.label} API key`
    })
  );

  if (apiKey === null) {
    throw new Error("Cancelled");
  }

  if (!apiKey) {
    if (provider.optionalApiKey) {
      return;
    }
    throw new Error("Cancelled");
  }

  await authStore.setApiKey(provider.id, apiKey);
}

async function loginOAuth(provider: ProviderDefinition, authStore: AuthStore): Promise<void> {
  const oauthProvider = getOAuthProvider(provider.id as OAuthProviderId);
  if (!oauthProvider) {
    throw new Error(`OAuth login not supported for ${provider.id}`);
  }

  const credentials = await oauthProvider.login({
    onAuth: (info) => {
      note(`${info.url}${info.instructions ? `\n${info.instructions}` : ""}`, "Open this URL");
    },
    onPrompt: async (prompt) => {
      const value = await promptValue<string>(
        input({
          message: prompt.placeholder
            ? `${prompt.message} (${prompt.placeholder})`
            : prompt.message
        })
      );
      if (!value) {
        throw new Error("Cancelled");
      }
      return value;
    },
    onProgress: (message) => {
      note(message, "OAuth");
    }
  });

  await authStore.setOAuth(provider.id, credentials as Record<string, unknown>);
}

async function selectModel(provider: ProviderDefinition): Promise<string | null> {
  if (provider.kind === "openai-compatible") {
    const modelId = await promptValue<string>(
      input({
        message: "Model id (e.g. llama-3.1-8b)"
      })
    );
    if (!modelId) {
      return null;
    }
    return modelId;
  }

  const models = getModels(provider.id as never);
  const options = models.map((model) => ({
    value: model.id,
    name: model.id,
    description: model.name
  }));
  options.push({ value: "__custom__", name: "Enter custom model id", description: "" });

  const selected = await promptValue<string>(
    select({
      message: "Select model",
      choices: options
    })
  );

  if (selected === null) {
    return null;
  }

  if (selected === "__custom__") {
    const custom = await promptValue<string>(
      input({ message: "Custom model id" })
    );
    if (!custom) {
      return null;
    }
    return custom;
  }

  return selected;
}

async function collectProviderOptions(
  provider: ProviderDefinition
): Promise<Record<string, unknown> | null> {
  switch (provider.id) {
    case "azure-openai-responses": {
      const azureBaseUrl = await promptValue<string>(
        input({
          message: "Azure OpenAI base URL (optional, e.g. https://<resource>.openai.azure.com)"
        })
      );
      if (azureBaseUrl === null) {
        return null;
      }
      const azureResourceName = await promptValue<string>(
        input({
          message: "Azure resource name (optional, e.g. my-azure-openai)"
        })
      );
      if (azureResourceName === null) {
        return null;
      }
      const azureApiVersion = await promptValue<string>(
        input({
          message: "Azure API version (optional, e.g. v1)"
        })
      );
      if (azureApiVersion === null) {
        return null;
      }
      const azureDeploymentName = await promptValue<string>(
        input({
          message: "Azure deployment name (optional, e.g. gpt-4o-mini)"
        })
      );
      if (azureDeploymentName === null) {
        return null;
      }
      return cleanOptions({
        azureBaseUrl: azureBaseUrl || undefined,
        azureResourceName: azureResourceName || undefined,
        azureApiVersion: azureApiVersion || undefined,
        azureDeploymentName: azureDeploymentName || undefined
      });
    }
    case "google-vertex": {
      const project = await promptValue<string>(
        input({
          message: "Google Cloud project id (optional)"
        })
      );
      if (project === null) {
        return null;
      }
      const location = await promptValue<string>(
        input({
          message: "Vertex AI location (optional, e.g. us-central1)"
        })
      );
      if (location === null) {
        return null;
      }
      return cleanOptions({
        project: project || undefined,
        location: location || undefined
      });
    }
    case "amazon-bedrock": {
      const region = await promptValue<string>(
        input({
          message: "AWS region (optional, e.g. us-east-1)"
        })
      );
      if (region === null) {
        return null;
      }
      const profile = await promptValue<string>(
        input({
          message: "AWS profile (optional, e.g. default)"
        })
      );
      if (profile === null) {
        return null;
      }
      return cleanOptions({
        region: region || undefined,
        profile: profile || undefined
      });
    }
    case "openai-compatible": {
      const baseUrl = await promptValue<string>(
        input({
          message: "OpenAI-compatible base URL (e.g. http://localhost:11434/v1)"
        })
      );
      if (!baseUrl) {
        return null;
      }
      const api = await promptValue<string>(
        select({
          message: "API type",
          choices: [
            { value: "openai-completions", name: "OpenAI Chat Completions" },
            { value: "openai-responses", name: "OpenAI Responses" }
          ]
        })
      );
      if (api === null) {
        return null;
      }
      return cleanOptions({ baseUrl, api });
    }
    default:
      return {};
  }
}

function isPromptCancelled(error: unknown): boolean {
  return error instanceof Error && error.name === "ExitPromptError";
}

async function promptValue<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (isPromptCancelled(error)) {
      return null;
    }
    throw error;
  }
}

function createPromptHelpers() {
  return {
    input: (config: Parameters<typeof input>[0]) => promptValue(input(config)),
    confirm: (config: Parameters<typeof confirm>[0]) => promptValue(confirm(config)),
    select: <TValue extends string>(config: Parameters<typeof select<TValue>>[0]) =>
      promptValue(select(config))
  };
}

async function validatePluginLoad(
  settings: Awaited<ReturnType<typeof readSettingsFile>>,
  dataDir: string,
  authStore: AuthStore,
  pluginConfig: PluginInstanceSettings
): Promise<void> {
  const connectorRegistry = new ConnectorRegistry({
    onMessage: async () => undefined,
    onFatal: () => undefined
  });
  const inferenceRegistry = new InferenceRegistry();
  const imageRegistry = new ImageGenerationRegistry();
  const toolRegistry = new ToolRegistry();
  const pluginRegistry = new PluginRegistry(
    connectorRegistry,
    inferenceRegistry,
    imageRegistry,
    toolRegistry
  );
  const pluginEventQueue = new PluginEventQueue();
  const fileStore = new FileStore({ basePath: `${dataDir}/files` });
  const pluginManager = new PluginManager({
    settings,
    registry: pluginRegistry,
    auth: authStore,
    fileStore,
    pluginCatalog: buildPluginCatalog(),
    dataDir,
    eventQueue: pluginEventQueue,
    mode: "validate"
  });

  await pluginManager.load(pluginConfig);
  try {
    await pluginManager.unload(pluginConfig.instanceId);
  } catch (error) {
    note(`Plugin validation unload failed: ${(error as Error).message}`, "Plugin");
  }
}

function cleanOptions(options: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined && value !== "")
  );
}

function intro(message: string): void {
  console.log(message);
}

function outro(message: string): void {
  console.log(message);
}

function note(message: string, title?: string): void {
  if (title) {
    console.log(`${title}: ${message}`);
    return;
  }
  console.log(message);
}
