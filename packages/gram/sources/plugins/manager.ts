import path from "node:path";
import { promises as fs } from "node:fs";

import { getLogger } from "../log.js";
import type { FileStore } from "../files/store.js";
import type { SecretsStore } from "../secrets/store.js";
import type { PluginInstanceSettings, SettingsConfig } from "../settings.js";
import { listEnabledPlugins } from "../settings.js";
import type { PluginEventQueue } from "./events.js";
import { PluginModuleLoader } from "./loader.js";
import type { PluginDefinition } from "./catalog.js";
import type { PluginApi, PluginInstance, PluginModule } from "./types.js";
import type { PluginRegistry } from "./registry.js";

export type PluginManagerOptions = {
  settings: SettingsConfig;
  registry: PluginRegistry;
  secrets: SecretsStore;
  fileStore: FileStore;
  pluginCatalog: Map<string, PluginDefinition>;
  dataDir: string;
  eventQueue: PluginEventQueue;
};

type LoadedPlugin = {
  module: PluginModule;
  instance: PluginInstance;
  config: PluginInstanceSettings;
  registrar: ReturnType<PluginRegistry["createRegistrar"]>;
  dataDir: string;
  settings: unknown;
};

export class PluginManager {
  private settings: SettingsConfig;
  private registry: PluginRegistry;
  private secrets: SecretsStore;
  private fileStore: FileStore;
  private pluginCatalog: Map<string, PluginDefinition>;
  private dataDir: string;
  private eventQueue: PluginEventQueue;
  private loaded = new Map<string, LoadedPlugin>();
  private logger = getLogger("plugins.manager");

  constructor(options: PluginManagerOptions) {
    this.settings = options.settings;
    this.registry = options.registry;
    this.secrets = options.secrets;
    this.fileStore = options.fileStore;
    this.pluginCatalog = options.pluginCatalog;
    this.dataDir = options.dataDir;
    this.eventQueue = options.eventQueue;
  }

  listLoaded(): string[] {
    return Array.from(this.loaded.keys());
  }

  listAvailable(): string[] {
    return Array.from(this.pluginCatalog.keys());
  }

  updateSettings(settings: SettingsConfig): void {
    this.settings = settings;
  }

  getConfig(instanceId: string): PluginInstanceSettings | null {
    return this.loaded.get(instanceId)?.config ?? null;
  }

  async load(pluginConfig: PluginInstanceSettings): Promise<void> {
    const instanceId = pluginConfig.instanceId;
    if (this.loaded.has(instanceId)) {
      return;
    }

    const definition = this.pluginCatalog.get(pluginConfig.pluginId);
    if (!definition) {
      throw new Error(`Unknown plugin: ${pluginConfig.pluginId}`);
    }

    const loader = new PluginModuleLoader(`plugin:${instanceId}`);
    const { module } = await loader.load(definition.entryPath);
    const parsedSettings = module.settingsSchema.parse(pluginConfig.settings ?? {});

    const registrar = this.registry.createRegistrar(instanceId);
    const dataDir = await this.ensurePluginDir(instanceId);

    const api: PluginApi = {
      instance: pluginConfig,
      settings: parsedSettings,
      engineSettings: this.settings,
      logger: getLogger(`plugin.${instanceId}`),
      secrets: this.secrets,
      dataDir,
      registrar,
      fileStore: this.fileStore,
      events: {
        emit: (event) => {
          this.eventQueue.emit(
            { pluginId: pluginConfig.pluginId, instanceId },
            event
          );
        }
      }
    };

    const instance = await module.create(api);

    try {
      await instance.load?.();
      this.loaded.set(instanceId, {
        module,
        instance,
        config: pluginConfig,
        registrar,
        dataDir,
        settings: parsedSettings
      });
      this.logger.info(
        { plugin: pluginConfig.pluginId, instance: instanceId },
        "Plugin loaded"
      );
    } catch (error) {
      await registrar.unregisterAll();
      throw error;
    }
  }

  async unload(instanceId: string): Promise<void> {
    const entry = this.loaded.get(instanceId);
    if (!entry) {
      return;
    }

    try {
      await entry.instance.unload?.();
    } finally {
      await entry.registrar.unregisterAll();
      this.loaded.delete(instanceId);
      this.logger.info({ instance: instanceId }, "Plugin unloaded");
    }
  }

  async loadEnabled(settings: SettingsConfig): Promise<void> {
    this.settings = settings;
    const enabled = listEnabledPlugins(settings);
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

  private async ensurePluginDir(instanceId: string): Promise<string> {
    const dir = path.join(this.dataDir, "plugins", instanceId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }
}
