import path from "node:path";
import { promises as fs } from "node:fs";

import { getLogger } from "../log.js";
import type { FileStore } from "../files/store.js";
import type { SecretsStore } from "../secrets/store.js";
import type { PluginSettings, SettingsConfig } from "../settings.js";
import type { Plugin, PluginContext } from "./types.js";
import type { PluginRegistry } from "./registry.js";

export type PluginFactory = () => Plugin;

export type PluginManagerOptions = {
  settings: SettingsConfig;
  registry: PluginRegistry;
  secrets: SecretsStore;
  fileStore: FileStore;
  pluginFactories: Map<string, PluginFactory>;
  dataDir: string;
};

type LoadedPlugin = {
  plugin: Plugin;
  config: PluginSettings;
  registrar: ReturnType<PluginRegistry["createRegistrar"]>;
  dataDir: string;
};

export class PluginManager {
  private settings: SettingsConfig;
  private registry: PluginRegistry;
  private secrets: SecretsStore;
  private fileStore: FileStore;
  private pluginFactories: Map<string, PluginFactory>;
  private dataDir: string;
  private loaded = new Map<string, LoadedPlugin>();
  private logger = getLogger("plugins.manager");

  constructor(options: PluginManagerOptions) {
    this.settings = options.settings;
    this.registry = options.registry;
    this.secrets = options.secrets;
    this.fileStore = options.fileStore;
    this.pluginFactories = options.pluginFactories;
    this.dataDir = options.dataDir;
  }

  listLoaded(): string[] {
    return Array.from(this.loaded.keys());
  }

  updateSettings(settings: SettingsConfig): void {
    this.settings = settings;
  }

  getConfig(id: string): PluginSettings | null {
    return this.loaded.get(id)?.config ?? null;
  }

  async load(pluginConfig: PluginSettings): Promise<void> {
    const id = pluginConfig.id;
    if (this.loaded.has(id)) {
      return;
    }
    const factory = this.pluginFactories.get(id);
    if (!factory) {
      throw new Error(`Unknown plugin: ${id}`);
    }

    const plugin = factory();
    const registrar = this.registry.createRegistrar(id);
    const dataDir = await this.ensurePluginDir(id);
    const context: PluginContext = {
      config: pluginConfig,
      settings: this.settings,
      logger: getLogger(`plugin.${id}`),
      secrets: this.secrets,
      dataDir,
      registrar,
      fileStore: this.fileStore
    };

    await plugin.load(context);
    this.loaded.set(id, { plugin, config: pluginConfig, registrar, dataDir });
    this.logger.info({ plugin: id }, "Plugin loaded");
  }

  async unload(id: string): Promise<void> {
    const entry = this.loaded.get(id);
    if (!entry) {
      return;
    }
    const context: PluginContext = {
      config: entry.config,
      settings: this.settings,
      logger: getLogger(`plugin.${id}`),
      secrets: this.secrets,
      dataDir: entry.dataDir,
      registrar: entry.registrar,
      fileStore: this.fileStore
    };

    try {
      await entry.plugin.unload(context);
    } finally {
      await entry.registrar.unregisterAll();
      this.loaded.delete(id);
      this.logger.info({ plugin: id }, "Plugin unloaded");
    }
  }

  async loadEnabled(settings: SettingsConfig): Promise<void> {
    this.settings = settings;
    const enabled = (settings.plugins ?? []).filter(
      (plugin) => plugin.enabled !== false
    );
    for (const plugin of enabled) {
      await this.load(plugin);
    }
  }

  async unloadAll(): Promise<void> {
    const ids = Array.from(this.loaded.keys());
    for (const id of ids) {
      await this.unload(id);
    }
  }

  private async ensurePluginDir(id: string): Promise<string> {
    const dir = path.join(this.dataDir, "plugins", id);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }
}
