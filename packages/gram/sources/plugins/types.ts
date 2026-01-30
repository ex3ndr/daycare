import type { Logger } from "pino";

import type { FileStore } from "../files/store.js";
import type { SecretsStore } from "../secrets/store.js";
import type { SettingsConfig, PluginSettings } from "../settings.js";
import type { PluginRegistrar } from "./registry.js";

export type PluginKind =
  | "connector"
  | "inference"
  | "tool"
  | "mixed";

export type PluginContext = {
  config: PluginSettings;
  settings: SettingsConfig;
  logger: Logger;
  secrets: SecretsStore;
  dataDir: string;
  registrar: PluginRegistrar;
  fileStore: FileStore;
};

export type Plugin = {
  id: string;
  kind: PluginKind;
  load: (context: PluginContext) => Promise<void>;
  unload: (context: PluginContext) => Promise<void>;
};
