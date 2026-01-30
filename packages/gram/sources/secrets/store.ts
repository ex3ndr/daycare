import { promises as fs } from "node:fs";
import path from "node:path";

export type SecretsConfig = {
  version: number;
  secrets: Record<string, Record<string, string>>;
};

export const DEFAULT_SECRETS_PATH = ".scout/secrets.json";

const DEFAULT_CONFIG: SecretsConfig = {
  version: 1,
  secrets: {}
};

export class SecretsStore {
  private filePath: string;

  constructor(filePath: string = DEFAULT_SECRETS_PATH) {
    this.filePath = filePath;
  }

  async read(): Promise<SecretsConfig> {
    const resolvedPath = path.resolve(this.filePath);
    try {
      const raw = await fs.readFile(resolvedPath, "utf8");
      const parsed = JSON.parse(raw) as SecretsConfig;
      if (!parsed || typeof parsed !== "object") {
        return { ...DEFAULT_CONFIG };
      }
      return {
        version: parsed.version ?? DEFAULT_CONFIG.version,
        secrets: parsed.secrets ?? {}
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { ...DEFAULT_CONFIG };
      }
      throw error;
    }
  }

  async write(config: SecretsConfig): Promise<void> {
    const resolvedPath = path.resolve(this.filePath);
    const dir = path.dirname(resolvedPath);
    if (dir && dir !== ".") {
      await fs.mkdir(dir, { recursive: true });
    }
    const payload = `${JSON.stringify(config, null, 2)}\n`;
    await fs.writeFile(resolvedPath, payload, { mode: 0o600 });
  }

  async get(pluginId: string, key: string): Promise<string | null> {
    const config = await this.read();
    return config.secrets[pluginId]?.[key] ?? null;
  }

  async set(pluginId: string, key: string, value: string): Promise<void> {
    const config = await this.read();
    const plugin = config.secrets[pluginId] ?? {};
    plugin[key] = value;
    config.secrets[pluginId] = plugin;
    await this.write(config);
  }

  async remove(pluginId: string, key: string): Promise<void> {
    const config = await this.read();
    if (!config.secrets[pluginId]) {
      return;
    }
    delete config.secrets[pluginId]![key];
    await this.write(config);
  }

  async listPluginSecrets(pluginId: string): Promise<Record<string, string>> {
    const config = await this.read();
    return { ...(config.secrets[pluginId] ?? {}) };
  }
}
